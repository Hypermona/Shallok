import { parse, traverse, generate, t } from './babel-compat.js';
import { isLikelyUserFacingText, isUserFacingAttribute, isIgnoredAttribute } from './heuristics.js';
import { generateSemanticKey } from '../keys/generator.js';
import { ExtractedString, ExtractionResult, FileTransformResult } from '../types/extractor.js';

export interface ExtractOptions {
  filePath: string;
  code: string;
  existingKeys?: Map<string, string>;
  framework?: 'react' | 'nextjs' | 'vue' | 'astro' | 'expo' | 'unknown';
}

export interface TransformOptions extends ExtractOptions {
  hookName?: string;
  packageName?: string;
}

/**
 * Parses and extracts user-facing strings from a source file using AST analysis.
 */
export function extractStringsFromSource(options: ExtractOptions): ExtractionResult {
  const { filePath, code, existingKeys = new Map() } = options;
  const strings: ExtractedString[] = [];
  const skippedStrings: ExtractionResult['skippedStrings'] = [];

  let ast: any;
  try {
    ast = parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });
  } catch (err: any) {
    skippedStrings.push({
      reason: `AST parse error: ${err.message}`,
      content: '',
      occurrence: { relative_file_path: filePath, line: 1 },
    });
    return { strings: [], modifiedFiles: [], skippedStrings };
  }

  traverse(ast, {
    // 1. Skip imports
    ImportDeclaration(path: any) {
      path.skip();
    },

    // 2. Skip console and logger calls
    CallExpression(path: any) {
      const callee = path.node.callee;
      // Skip console.log, console.error etc.
      if (
        t.isMemberExpression(callee) &&
        t.isIdentifier(callee.object) &&
        (callee.object.name === 'console' || callee.object.name === 'logger')
      ) {
        path.skip();
        return;
      }

      // Skip already translated calls: t('...') or i18n.t('...')
      if (
        t.isIdentifier(callee, { name: 't' }) ||
        (t.isMemberExpression(callee) &&
          t.isIdentifier(callee.object, { name: 'i18n' }) &&
          t.isIdentifier(callee.property, { name: 't' }))
      ) {
        path.skip();
        return;
      }
    },

    // 3. Extract JSXText
    JSXText(path: any) {
      const text = path.node.value;
      const trimmed = text.trim();
      if (!isLikelyUserFacingText(trimmed)) {
        return;
      }

      const line = path.node.loc?.start.line || 1;
      const column = path.node.loc?.start.column || 0;
      const tagName = (path.parent as any)?.openingElement?.name?.name || 'element';
      const { context: richContext, hasExplicitComment } = deriveEnclosingContext(path, `JSX text in <${tagName}>`);

      const suggestedKey = generateSemanticKey({
        filePath,
        content: trimmed,
        context: richContext,
        existingKeys,
      });

      // Track existing key in mapping for this extraction session
      existingKeys.set(suggestedKey, trimmed);

      strings.push({
        suggestedKey,
        content: trimmed,
        context: richContext,
        hasExplicitComment,
        occurrence: {
          relative_file_path: filePath,
          line,
          column,
        },
      });
    },

    // 4. Extract JSXAttribute (e.g. placeholder, aria-label, title)
    JSXAttribute(path: any) {
      const attrName = path.node.name.name;
      if (typeof attrName !== 'string' || isIgnoredAttribute(attrName)) {
        return;
      }

      if (!isUserFacingAttribute(attrName)) {
        return;
      }

      const val = path.node.value;
      if (t.isStringLiteral(val)) {
        const trimmed = val.value.trim();
        if (!isLikelyUserFacingText(trimmed)) {
          return;
        }

        const line = val.loc?.start.line || 1;
        const column = val.loc?.start.column || 0;
        const { context: richContext, hasExplicitComment } = deriveEnclosingContext(path, `${attrName} attribute`);

        const suggestedKey = generateSemanticKey({
          filePath,
          content: trimmed,
          context: richContext,
          existingKeys,
        });

        existingKeys.set(suggestedKey, trimmed);

        strings.push({
          suggestedKey,
          content: trimmed,
          context: richContext,
          hasExplicitComment,
          occurrence: {
            relative_file_path: filePath,
            line,
            column,
          },
        });
      }
    },

    // 5. Extract string literals inside JSXExpressionContainer conditional or logical expressions
    JSXExpressionContainer(path: any) {
      path.traverse({
        StringLiteral(subPath: any) {
          // Check if parent is ConditionalExpression or LogicalExpression
          if (
            t.isConditionalExpression(subPath.parent) ||
            t.isLogicalExpression(subPath.parent)
          ) {
            const trimmed = subPath.node.value.trim();
            if (isLikelyUserFacingText(trimmed)) {
              const line = subPath.node.loc?.start.line || 1;
              const column = subPath.node.loc?.start.column || 0;
              const { context: richContext, hasExplicitComment } = deriveEnclosingContext(subPath, 'conditional UI message');

              const suggestedKey = generateSemanticKey({
                filePath,
                content: trimmed,
                context: richContext,
                existingKeys,
              });

              existingKeys.set(suggestedKey, trimmed);

              strings.push({
                suggestedKey,
                content: trimmed,
                context: richContext,
                hasExplicitComment,
                occurrence: {
                  relative_file_path: filePath,
                  line,
                  column,
                },
              });
            }
          }
        },
      });
    },
  });

  return {
    strings,
    modifiedFiles: strings.length > 0 ? [filePath] : [],
    skippedStrings,
  };
}

/**
 * Transforms a source file by replacing extracted strings with translation calls (t(...))
 * and inserting necessary hook imports and initializations.
 */
export function transformSourceFile(options: TransformOptions): FileTransformResult {
  const {
    filePath,
    code,
    existingKeys = new Map(),
    hookName = options.framework === 'nextjs' ? 'useTranslations' : 'useTranslation',
    packageName = options.framework === 'nextjs' ? 'next-intl' : 'react-i18next',
  } = options;

  let ast: any;
  try {
    ast = parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });
  } catch {
    return {
      filePath,
      originalCode: code,
      transformedCode: code,
      changed: false,
      extractedKeys: [],
    };
  }

  const extractedKeys: string[] = [];
  let modified = false;

  traverse(ast, {
    ImportDeclaration(path: any) {
      path.skip();
    },

    CallExpression(path: any) {
      const callee = path.node.callee;
      if (
        t.isMemberExpression(callee) &&
        t.isIdentifier(callee.object) &&
        (callee.object.name === 'console' || callee.object.name === 'logger')
      ) {
        path.skip();
        return;
      }
      if (
        t.isIdentifier(callee, { name: 't' }) ||
        (t.isMemberExpression(callee) &&
          t.isIdentifier(callee.object, { name: 'i18n' }) &&
          t.isIdentifier(callee.property, { name: 't' }))
      ) {
        path.skip();
        return;
      }
    },

    JSXText(path: any) {
      const text = path.node.value;
      const trimmed = text.trim();
      if (!isLikelyUserFacingText(trimmed)) {
        return;
      }

      const key = generateSemanticKey({
        filePath,
        content: trimmed,
        existingKeys,
      });

      existingKeys.set(key, trimmed);
      extractedKeys.push(key);

      // Replace JSXText with {t('key')}
      const replacement = t.jsxExpressionContainer(
        t.callExpression(t.identifier('t'), [t.stringLiteral(key)])
      );

      path.replaceWith(replacement);
      modified = true;
    },

    JSXAttribute(path: any) {
      const attrName = path.node.name.name;
      if (typeof attrName !== 'string' || isIgnoredAttribute(attrName) || !isUserFacingAttribute(attrName)) {
        return;
      }

      const val = path.node.value;
      if (t.isStringLiteral(val)) {
        const trimmed = val.value.trim();
        if (!isLikelyUserFacingText(trimmed)) {
          return;
        }

        const key = generateSemanticKey({
          filePath,
          content: trimmed,
          context: `attribute ${attrName}`,
          existingKeys,
        });

        existingKeys.set(key, trimmed);
        extractedKeys.push(key);

        // Replace attribute value with {t('key')}
        const replacement = t.jsxExpressionContainer(
          t.callExpression(t.identifier('t'), [t.stringLiteral(key)])
        );

        path.node.value = replacement;
        modified = true;
      }
    },

    JSXExpressionContainer(path: any) {
      path.traverse({
        StringLiteral(subPath: any) {
          if (
            t.isConditionalExpression(subPath.parent) ||
            t.isLogicalExpression(subPath.parent)
          ) {
            const trimmed = subPath.node.value.trim();
            if (isLikelyUserFacingText(trimmed)) {
              const key = generateSemanticKey({
                filePath,
                content: trimmed,
                context: 'conditional JSX message',
                existingKeys,
              });

              existingKeys.set(key, trimmed);
              extractedKeys.push(key);

              subPath.replaceWith(
                t.callExpression(t.identifier('t'), [t.stringLiteral(key)])
              );
              modified = true;
            }
          }
        },
      });
    },
  });

  if (!modified) {
    return {
      filePath,
      originalCode: code,
      transformedCode: code,
      changed: false,
      extractedKeys: [],
    };
  }

  // Inject hook import and hook call in components
  injectHookAndImport({
    ast,
    hookName,
    packageName,
  });

  const generated = generate(ast, {
    retainLines: false,
    compact: false,
  });

  return {
    filePath,
    originalCode: code,
    transformedCode: generated.code,
    changed: true,
    extractedKeys,
  };
}

/**
 * Checks if the translation hook is imported and injects it along with the call
 * `const { t } = useTranslation();` or `const t = useTranslations();` in top-level functions.
 */
function injectHookAndImport(options: {
  ast: any;
  hookName: string;
  packageName: string;
}) {
  const { ast, hookName, packageName } = options;

  let hasImport = false;

  traverse(ast, {
    ImportDeclaration(path: any) {
      if (path.node.source.value === packageName) {
        for (const spec of path.node.specifiers) {
          if (t.isImportSpecifier(spec) && (spec.imported as any).name === hookName) {
            hasImport = true;
          }
        }
      }
    },
  });

  // Inject import at the top of the program if missing
  if (!hasImport) {
    const importSpecifier = t.importSpecifier(
      t.identifier(hookName),
      t.identifier(hookName)
    );
    const importDecl = t.importDeclaration(
      [importSpecifier],
      t.stringLiteral(packageName)
    );
    ast.program.body.unshift(importDecl);
  }

  // Inject hook inside function declarations or arrow functions that render JSX
  traverse(ast, {
    FunctionDeclaration(path: any) {
      injectHookIntoBody(path.node.body, hookName);
    },
    FunctionExpression(path: any) {
      if (t.isBlockStatement(path.node.body)) {
        injectHookIntoBody(path.node.body, hookName);
      }
    },
    ArrowFunctionExpression(path: any) {
      if (t.isBlockStatement(path.node.body)) {
        injectHookIntoBody(path.node.body, hookName);
      }
    },
  });
}

function injectHookIntoBody(
  body: any, // BlockStatement
  hookName: string
) {
  // Check if `t` is already declared in this scope
  let hasTDeclaration = false;
  for (const stmt of body.body) {
    if (t.isVariableDeclaration(stmt)) {
      for (const decl of stmt.declarations) {
        if (
          t.isObjectPattern(decl.id) &&
          decl.id.properties.some((p: any) => p.key?.name === 't' || p.value?.name === 't')
        ) {
          hasTDeclaration = true;
        } else if (t.isIdentifier(decl.id, { name: 't' })) {
          hasTDeclaration = true;
        }
      }
    }
  }

  if (!hasTDeclaration) {
    let hookStatement: any;
    if (hookName === 'useTranslation') {
      // const { t } = useTranslation();
      hookStatement = t.variableDeclaration('const', [
        t.variableDeclarator(
          t.objectPattern([
            t.objectProperty(t.identifier('t'), t.identifier('t'), false, true),
          ]),
          t.callExpression(t.identifier('useTranslation'), [])
        ),
      ]);
    } else {
      // const t = useTranslations();
      hookStatement = t.variableDeclaration('const', [
        t.variableDeclarator(
          t.identifier('t'),
          t.callExpression(t.identifier('useTranslations'), [])
        ),
      ]);
    }

    body.body.unshift(hookStatement);
  }
}

/**
 * Derives rich semantic context from AST parent nodes, enclosing component,
 * and developer comments.
 */
function deriveEnclosingContext(
  path: any,
  fallback: string
): { context: string; hasExplicitComment: boolean } {
  // 1. Check for developer context comments: {/* context: ... */} or // i18n-context: ...
  const comments = path.node.leadingComments || path.parent?.leadingComments || [];
  for (const c of comments) {
    const val = (c.value || '').trim();
    if (/^(context|i18n-context|desc|description):/i.test(val)) {
      const explicit = val.replace(/^(context|i18n-context|desc|description):\s*/i, '').trim();
      return { context: explicit, hasExplicitComment: true };
    }
  }

  // 2. Identify enclosing React component or function
  let componentName = '';
  let curr = path.parentPath;
  while (curr) {
    if (curr.isFunctionDeclaration && curr.isFunctionDeclaration()) {
      componentName = curr.node.id?.name || '';
      break;
    }
    if (curr.isVariableDeclarator && curr.isVariableDeclarator()) {
      componentName = curr.node.id?.name || '';
      break;
    }
    curr = curr.parentPath;
  }

  // 3. Identify parent JSX element and semantic class or role
  let tagInfo = '';
  let parentEl = path.findParent ? path.findParent((p: any) => p.isJSXElement && p.isJSXElement()) : null;
  if (parentEl && parentEl.node?.openingElement) {
    const opening = parentEl.node.openingElement;
    const tagName = opening.name?.name || 'element';
    const classNameAttr = (opening.attributes || []).find(
      (a: any) => a.type === 'JSXAttribute' && (a.name?.name === 'className' || a.name?.name === 'class')
    );
    const className = classNameAttr?.value?.value ? `.${classNameAttr.value.value}` : '';
    tagInfo = `<${tagName}${className}>`;
  }

  const parts = [];
  if (componentName) parts.push(`in ${componentName}`);
  if (tagInfo) parts.push(tagInfo);

  const contextStr = parts.length > 0 ? `${fallback} (${parts.join(' ')})` : fallback;
  return { context: contextStr, hasExplicitComment: false };
}
