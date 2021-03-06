import Command from '../models/commandInterface'
import { Message } from 'discord.js'

export class TimeCommand implements Command {
  commandNames = 'time'

  help(commandPrefix: string): string {
    return `Use ${commandPrefix}time to show current time.`
  }

  async run(message: Message): Promise<void> {
    const now = new Date()
    await message.reply(`${now.getHours()} : ${now.getMinutes()}`)
  }
}
