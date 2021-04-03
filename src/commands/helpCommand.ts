import Command from '../models/commandInterface'
import { Message, MessageEmbed } from 'discord.js'

export class HelpCommand implements Command {
  commandNames = 'help'

  help(commandPrefix: string): string {
    return `Try ${commandPrefix}help.`
  }

  async run(message: Message, commandsNames: string[]): Promise<void> {
    const embed = new MessageEmbed()
      .setColor('#DAF7A6')
      .addField('Commands list', commandsNames.join('\n'))
    await message.channel.send(embed)
  }
}
