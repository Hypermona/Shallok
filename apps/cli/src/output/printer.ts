import chalk from 'chalk';

export class Printer {
  constructor(private isJson = false) {}

  json(data: unknown): void {
    console.log(JSON.stringify(data, null, 2));
  }

  log(message: string): void {
    if (!this.isJson) {
      console.log(message);
    }
  }

  info(message: string): void {
    if (!this.isJson) {
      console.log(chalk.blue('ℹ') + ' ' + message);
    }
  }

  success(message: string): void {
    if (!this.isJson) {
      console.log(chalk.green('✔') + ' ' + message);
    }
  }

  warn(message: string): void {
    if (!this.isJson) {
      console.warn(chalk.yellow('⚠') + ' ' + message);
    }
  }

  error(message: string): void {
    if (this.isJson) {
      console.error(JSON.stringify({ error: message }));
    } else {
      console.error(chalk.red('✖') + ' ' + message);
    }
  }

  header(title: string): void {
    if (!this.isJson) {
      console.log('\n' + chalk.bold.cyan(title));
      console.log(chalk.dim('─'.repeat(title.length + 4)));
    }
  }

  divider(): void {
    if (!this.isJson) {
      console.log(chalk.dim('─'.repeat(50)));
    }
  }
}
