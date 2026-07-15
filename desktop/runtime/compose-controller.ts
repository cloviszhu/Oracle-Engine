export type CommandRunner = (command: string, args: string[]) => Promise<{ stdout: string; stderr: string }>;

export class SerenityComposeController {
  constructor(private readonly run: CommandRunner, private readonly composeFile: string) {}

  startInfrastructure(): Promise<{ stdout: string; stderr: string }> {
    return this.run('docker', ['compose', '-p', 'serenity-local', '-f', this.composeFile, 'up', '-d', 'db', 'redis']);
  }

  stopInfrastructure(): Promise<{ stdout: string; stderr: string }> {
    return this.run('docker', ['compose', '-p', 'serenity-local', '-f', this.composeFile, 'down']);
  }
}
