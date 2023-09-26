import {
  MessagesEntity,
  ChannelsEntity,
  User,
  MutedEntity,
} from '@backend/typeorm';
import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReturnMessageDto } from './dto/return-message.dto';
import { plainToClass } from 'class-transformer';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(MessagesEntity)
    private readonly messagesRepository: Repository<MessagesEntity>,
    @InjectRepository(ChannelsEntity)
    private readonly channelRepository: Repository<ChannelsEntity>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(MutedEntity)
    private readonly mutedRepository: Repository<MutedEntity>,
  ) {}

  async createMessage(
    channelId: number,
    message: string,
    authorId: number,
  ): Promise<ReturnMessageDto> {
    const channel = await this.channelRepository.findOne({
      where: { chatId: channelId },
      relations: ['mutedUsers'],
    });
    // Logger.log(message)
    if (!channel) throw new NotFoundException('ChannelNotFound');
    const author = await this.userRepository.findOne({
      where: { id: authorId },
    });
    if (!author) throw new NotFoundException('User dont exist at this channel');
    if (channel.mutedUsers.find((user) => user.id == authorId))
      throw new ForbiddenException('User is muted');
    const newMessage = new MessagesEntity();
    newMessage.message = message;
    newMessage.author = author;
    newMessage.channel = channel;
    await this.messagesRepository.save(newMessage);
    return plainToClass(ReturnMessageDto, newMessage);
  }

  async findAllMessagesByChannel(
    channelId: number,
  ): Promise<ReturnMessageDto[]> {
    const channel = await this.channelRepository.findOne({
      where: { chatId: channelId },
    });
    if (!channel) {
      throw new NotFoundException('Channel not found');
    }
    // const numericValues = channel.chat_name.split(" ").map(word => {
    //   let numericWord = "";
    //   for (let i = 0; i < word.length; i++) {
    //     const charCode = word.charCodeAt(i);
    //     numericWord += charCode + " ";
    //   }
    //   return numericWord.trim(); // Удаляем последний пробел
    // }).map(numericString => numericString.split(" "))
    // .flat()
    // .join("")

    const messages = await this.messagesRepository.find({
      where: { channel: { chatId: channelId } },
      relations: ['author'],
    });

    if (messages.length < 1) return null;

    const formattedMessages: ReturnMessageDto[] = messages.map((message) => ({
      massageId: message.messageId,
      message: message.message,
      athor: message.author, // Предполагается, что в MessageEntity есть связь с автором
      my: `${message.createAt.getDate().toString().padStart(2, '0')}.${(
        message.createAt.getMonth() + 1
      )
        .toString()
        .padStart(2, '0')}.${message.createAt.getFullYear()}`,
      hm: `${message.createAt.getHours()}:${message.createAt.getMinutes()}`,
      updatedAtmy: message.updateAt
        ? `${message.updateAt.getDate().toString().padStart(2, '0')}.${(
            message.updateAt.getMonth() + 1
          )
            .toString()
            .padStart(2, '0')}.${message.updateAt.getFullYear()}`
        : null,
      updateAthm: message.updateAt
        ? `${message.createAt.getHours()}:${message.createAt.getMinutes()}`
        : null,
    }));

    return formattedMessages;
  }

  async findMessageById(id: number): Promise<MessagesEntity | null> {
    return this.messagesRepository.findOne({ where: { messageId: id } });
  }

  async updateMessage(
    id: number,
    message: string,
  ): Promise<ReturnMessageDto | null> {
    const existingMessage = await this.findMessageById(id);
    if (!existingMessage) {
      throw new NotFoundException('Message not found');
    }
    existingMessage.message = message;
    existingMessage.updateAt = new Date();
    this.messagesRepository.save(existingMessage);

    return plainToClass(ReturnMessageDto, existingMessage);
  }

  async deleteMessage(
    messageId: number,
    chatId: number,
  ): Promise<ReturnMessageDto[]> {
    const chat = await this.channelRepository.findOne({
      where: { chatId: chatId },
      relations: ['chatMessages'],
    });

    if (!chat) throw new NotFoundException('Chat not found');
    const existMess = chat.chatMessages.find(
      (message) => message.messageId == messageId,
    );
    if (!existMess)
      throw new NotFoundException('Message not found at this chat');

    await this.messagesRepository.delete(messageId);
    return await this.findAllMessagesByChannel(chatId);
  }
}