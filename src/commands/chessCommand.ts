import Command from '../models/commandInterface'
import { Message, MessageEmbed, TextChannel, User } from 'discord.js'
import { Chess, ChessInstance } from 'chess.js'

enum ChessSubCommand {
  reset = 'r',
}

enum ColorEmoji {
  w = '🌝',
  b = '🌚',
}

enum VersusEmoji {
  Player = '♟️',
  IA = '🎲',
}

class Player {
  user!: User
  colorSide!: keyof typeof ColorEmoji
}

class Game {
  players: Player[] = []

  private _playerOne: Player
  private _playerTwo: Player
  private chess: ChessInstance

  constructor(chess: ChessInstance) {
    this.chess = chess

    this._playerOne = new Player()
    this._playerTwo = new Player()
  }

  set playerOneUser(user: User) {
    this._playerOne.user = user
    this.players[0] = this._playerOne
  }

  set playerOneColor(colorSide: keyof typeof ColorEmoji) {
    this._playerOne.colorSide = colorSide
    this.players[0] = this._playerOne
  }

  set playerTwoUser(user: User) {
    this._playerTwo.user = user
    this.players[1] = this._playerTwo
  }

  set playerTwoColor(colorSide: keyof typeof ColorEmoji) {
    this._playerTwo.colorSide = colorSide
    this.players[1] = this._playerTwo
  }

  get whitePlayer(): Player | undefined {
    return this.players.find((player) => player.colorSide === this.chess.WHITE)
  }

  get blackPlayer(): Player | undefined {
    return this.players.find((player) => player.colorSide === this.chess.BLACK)
  }
}

export class ChessCommand implements Command {
  commandNames = ['chess', 'xadrez']

  subCommandNames: string[] = Object.values(ChessSubCommand)

  private chess: ChessInstance
  private game: Game

  private subCommandsContext!: string[]
  private lastMovementMessage!: Message
  private chessBoardMessageEmbed!: MessageEmbed

  constructor() {
    this.chess = new Chess()
    this.game = new Game(this.chess)
  }

  help(commandPrefix: string): string {
    return `Use ${commandPrefix}chess and your move.`
  }

  async run(message: Message, args: string[]): Promise<void> {
    this.chess.reset()

    const channel = message.channel as TextChannel

    this.game.playerOneUser = message.author

    await this.pickupSecondPlayer(message)

    await this.selectColor(message)

    const whitePlayer = this.game.whitePlayer
    const blackPlayer = this.game.blackPlayer

    if (whitePlayer && blackPlayer) {
      const chessBoardMessageEmbed = new MessageEmbed().setColor('#0099ff')

      chessBoardMessageEmbed
        .addField('White:', whitePlayer.user, true)
        .addField('Black:', blackPlayer.user, true)

      this.chessBoardMessageEmbed = chessBoardMessageEmbed

      await this.sendBoard(channel)

      this.sendAvailableMoves(whitePlayer.user)

      await this.awaitPlayersMoves(channel, whitePlayer)
    }
  }

  private async pickupSecondPlayer(message: Message) {
    const channel = message.channel

    const challengedPlayer = message.mentions.users.first()

    if (challengedPlayer) {
      this.game.playerTwoUser = challengedPlayer
    } else {
      await channel
        .send(
          `Who will you play against? ${VersusEmoji.Player} Player or ${VersusEmoji.IA} IA?`
        )
        .then(async (chooseVersusModeMessage) => {
          const emojis = Object.values(VersusEmoji)

          emojis.forEach(async (emoji) => {
            await chooseVersusModeMessage.react(emoji)
          })

          await chooseVersusModeMessage
            .awaitReactions(
              (reaction, user) =>
                user.id == message.author.id &&
                emojis.includes(reaction.emoji.name),
              { max: 1, time: 30000 }
            )
            .then(async (collected) => {
              chooseVersusModeMessage.delete()

              const selectedEmoji = collected.first()?.emoji.name

              if (selectedEmoji === VersusEmoji.Player) {
                await channel
                  .send('Which Player?')
                  .then(async (choosePlayerMessage) => {
                    await channel
                      .awaitMessages(
                        (channelMessage) =>
                          channelMessage.author.id === message.author.id,
                        { max: 1, time: 30000 }
                      )
                      .then((collected) => {
                        choosePlayerMessage.delete()

                        const playerChoiceMessage = collected.first()

                        playerChoiceMessage?.delete()

                        const challengedPlayer = playerChoiceMessage?.mentions.users.first()

                        if (!challengedPlayer) {
                          throw ReferenceError('Player Not Found')
                        }

                        this.game.playerTwoUser = challengedPlayer
                      })
                      .catch(() => {
                        throw Error()
                      })
                  })
              } else {
                console.log("IA")
              }
            })
            .catch((err) => {
              if (err instanceof ReferenceError) {
                throw ReferenceError(err.message)
              } else {
                throw Error('No reaction after 30 seconds, operation canceled')
              }
            })
        })
    }
  }

  private async selectColor(message: Message) {
    await message.channel
      .send('Choose a color to start')
      .then(async (chooseColorMessage) => {
        const emojis = Object.values(ColorEmoji)

        emojis.forEach(async (emoji) => {
          await chooseColorMessage.react(emoji)
        })

        await chooseColorMessage
          .awaitReactions(
            (reaction, user) =>
              user.id == message.author.id &&
              emojis.includes(reaction.emoji.name),
            { max: 1, time: 30000 }
          )
          .then(async (collected) => {
            chooseColorMessage.delete()

            const selectedEmoji = collected.first()?.emoji.name

            const whiteIsSelected = selectedEmoji === ColorEmoji.w

            this.game.playerOneColor = whiteIsSelected
              ? this.chess.WHITE
              : this.chess.BLACK

            this.game.playerTwoColor = whiteIsSelected
              ? this.chess.BLACK
              : this.chess.WHITE
          })
          .catch(() => {
            throw Error('No reaction after 30 seconds, operation canceled')
          })
      })
  }

  private async awaitPlayersMoves(channel: TextChannel, player: Player) {
    await channel
      .awaitMessages(
        (channelMessage) => channelMessage.author.id === player?.user.id,
        { max: 1 }
      )
      .then(async (collected) => {
        const playerMove = collected.first()?.channel.lastMessage

        if (playerMove) {
          playerMove.delete()

          const moves = this.chess.moves()

          if (moves.includes(playerMove.content)) {
            const actualTurn = this.chess.turn()

            this.chess.move(playerMove.content)

            await this.sendBoard(channel)

            const otherPlayer = this.game.players.find(
              (p) => p.user.id !== player?.user.id
            )

            if (otherPlayer) {
              player = otherPlayer

              if (!this.chess.game_over()) {
                this.sendAvailableMoves(player.user)

                await this.awaitPlayersMoves(channel, player)
              } else {
                await this.sendBoard(channel)

                const winPlayer = this.game.players.find(
                  (p) => p.colorSide === actualTurn
                )

                await channel.send(
                  `Congratulations ${winPlayer?.user.toString()}, you win 🎉`
                )
              }
            }
          } else {
            await channel.send(
              'Move not available, see your DM to check what moves you can do'
            )

            await this.awaitPlayersMoves(channel, player)
          }
        }
      })
  }

  private async sendAvailableMoves(user: User) {
    const moves = this.chess.moves()
    await user.send(`Available Moves: ${moves.join(', ')}`)
  }

  private async sendBoard(channel: TextChannel) {
    const encodedFen = encodeURI(this.chess.fen())

    let sideOfBoard = ''
    if (this.chess.turn() === this.chess.BLACK) {
      sideOfBoard = '-flip'
    }

    this.chessBoardMessageEmbed.setImage(
      `https://chessboardimage.com/${encodedFen}${sideOfBoard}.png`
    )

    const history = this.chess.history()
    if (history.length) {
      this.chessBoardMessageEmbed.setFooter(`History: ${history}`)
    }

    if (this.lastMovementMessage) this.lastMovementMessage.delete()

    await channel
      .send(this.chessBoardMessageEmbed)
      .then(async (messageSent) => (this.lastMovementMessage = messageSent))
  }
}
