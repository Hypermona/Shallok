import babelTraverse from '@babel/traverse';
import babelGenerator from '@babel/generator';
import * as babelParser from '@babel/parser';
import * as babelTypes from '@babel/types';

const rawTraverse: any = (babelTraverse as any).default || babelTraverse;
const rawGenerate: any = (babelGenerator as any).default || babelGenerator;

export const traverse: (ast: any, visitor: any) => void = rawTraverse;
export const generate: (ast: any, opts?: any, code?: string) => { code: string; map?: any } = rawGenerate;
export const parse = babelParser.parse;
export const t = babelTypes;
