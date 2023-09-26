import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BannedEntity,
  ChannelsEntity,
  MessagesEntity,
  MutedEntity,
  User,
} from '@backend/typeorm';
import { ReturnChanelDto } from './dto/return-cnannel.dto';
import { plainToClass } from 'class-transformer';
import { ChannelCreatedTO } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';
import { ChatUserDto } from './dto/chat-user.dto';
import { chatType } from '@backend/typeorm/channel.entity';
import { BannedService } from '@backend/banned/banned.service';
import { ReturnMessageDto } from '@backend/messages/dto/return-message.dto';
import { MessagesService } from '@backend/messages/messages.service';
import { MutedService } from '../muted/muted.service';
import { ReturnMutedDto } from '@backend/muted/dto/return-muted.dto';

@Injectable()
export class ChannelsService {
  constructor(
    //
    // private readonly mutedRepository: Repository<MutedEntity>,
    @InjectRepository(ChannelsEntity)
    private readonly channelsRepository: Repository<ChannelsEntity>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(MessagesEntity)
    @InjectRepository(MutedEntity)
    @InjectRepository(BannedEntity)
    private readonly bannedService: BannedService,
    private readonly messageService: MessagesService,
    private readonly mutedService: MutedService,
  ) {}

  async findAll(): Promise<ChannelsEntity[]> {
    const channels = await this.channelsRepository.find({
      relations: ['chatOwner'],
    });

    if (channels.length < 1) return null;
    return channels.map((chanel) => plainToClass(ChannelsEntity, chanel));
  }

  async findAllPublicChannels(): Promise<ChannelsEntity[]> {
    const channels = await this.channelsRepository
      .createQueryBuilder('channel')
      .where('channel.chatType = :chatType', { chatType: 'public' })
      .leftJoinAndSelect('channel.chatOwner', 'owner')
      .getMany();

    if (channels.length < 1) return null;

    return channels.map((chanel) => plainToClass(ChannelsEntity, chanel));
  }

  async findOneById(id: number): Promise<ChannelsEntity> {
    const channel = await this.channelsRepository.findOne({
      where: { chatId: id },
      relations: ['chatOwner'],
    });
    if (!channel) throw new NotFoundException('channelNotFound');
    return plainToClass(ChannelsEntity, channel);
  }

  async findOne(id: number): Promise<ChannelsEntity> {
    const channel = await this.channelsRepository.findOne({
      where: { chatId: id },
    });
    if (!channel) throw new NotFoundException('channelNotFound');
    // return plainToClass(ReturnChanelDto, channel, {
    //   excludeExtraneousValues: true,
    // });
    return channel;
  }

  async create(dto: ChannelCreatedTO): Promise<ChannelsEntity> {
    const owner = await this.userRepository.findOne({
      where: { id: dto.chatOwner },
    });
    if (!owner) {
      throw new NotFoundException('User not found');
    }
    // Logger.log(dto.chatName)
    if (dto.chatName == null)
      dto.chatName = `${dto.chatType} ${owner.firstName} chat`;
    // Logger.log(dto)
    const existingChannel = await this.channelsRepository.findOne({
      where: { chatName: dto.chatName },
    });
    if (existingChannel) {
      throw new ForbiddenException('Chanel with this name already exist');
    }

    const newChannel = new ChannelsEntity();
    newChannel.chatUsers = [];
    newChannel.chatUsers.push(owner);
    newChannel.chatName = dto.chatName;
    newChannel.chatOwner = owner;
    newChannel.password = dto.password || null;
    newChannel.maxUsers = dto.maxUsers || null;
    newChannel.chatType = dto.chatType;

    const chanel = await this.channelsRepository.save(newChannel);
    // return plainToClass(ReturnChanelDto, chanel);
    return plainToClass(ChannelsEntity, chanel);
  }

  async delete(chatId: number, userId: number): Promise<ChannelsEntity[]> {
    const chat = await this.channelsRepository.findOne({
      where: { chatId: chatId },
      relations: ['chatOwner'],
    });
    if (!chat) {
      throw new NotFoundException(`Chat with ID ${chatId} not found`);
    }
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (chat.chatOwner.id != user.id)
      throw new ForbiddenException('User is not chat owner');
    // chat.chatAdmins = [];
    // chat.chatUsers = [];
    // chat.chatMessages=[];
    // chat.activeUsers=[];
    // chat.mutedUsers=[];
    // chat.bannedUsers=[];

    // await this.channelsRepository.save(chat);

    await this.channelsRepository.remove(chat);

    return await this.findAll();
  }

  async update(chatId: number, dto: UpdateChannelDto): Promise<ChannelsEntity> {
    const chat = await this.channelsRepository.findOne({
      where: { chatId: chatId },
    });
    if (!chat) throw new NotFoundException('Channel not found');

    if (
      await this.channelsRepository.findOne({
        where: { chatName: dto.chatName },
      })
    )
      throw new ForbiddenException(
        `Channle with name ${dto.chatName} already exist`,
      );
    if (dto.chatName != null) {
      chat.chatName = dto.chatName;
    }

    if (dto.password != null) {
      chat.password = dto.password;
    }

    if (dto.maxUsers != null) {
      chat.maxUsers = dto.maxUsers;
    }

    if (chat.password != null && dto.password == null) chat.password = null;

    const updatedChat = await this.channelsRepository.save(chat);

    return plainToClass(ChannelsEntity, updatedChat);
  }

  async findUserPrivateChats(userId: number): Promise<ChannelsEntity[]> {
    const channels = await this.channelsRepository
      .createQueryBuilder('channel')
      .innerJoinAndSelect('channel.chatUsers', 'user', 'user.id = :userId', {
        userId,
      })
      .leftJoinAndSelect('channel.chatOwner', 'owner')
      .where('channel.chatType = :chatType', { chatType: chatType.PRIVATE })
      .getMany();

    if (channels.length < 1) return null;

    return channels.map((chanel) => plainToClass(ChannelsEntity, chanel));

    // const channelsDtos = plainToClass(ReturnChanelDto, channels);
  }

  async findUserProtectedChats(userId: number): Promise<ChannelsEntity[]> {
    const channels = await this.channelsRepository
      .createQueryBuilder('channel')
      .innerJoinAndSelect('channel.chatUsers', 'user', 'user.id = :userId', {
        userId,
      })
      .leftJoinAndSelect('channel.chatOwner', 'owner')
      .where('channel.chatType = :chatType', { chatType: chatType.PROTECTED })
      .getMany();

    // const channelsDTOs = plainToClass(ReturnChanelDto, channels);

    // return channelsDTOs;
    if (channels.length < 1) return null;

    return channels.map((chanel) => plainToClass(ChannelsEntity, chanel));
  }

  async findUserDmChats(userId: number): Promise<ChannelsEntity[]> {
    const channels = await this.channelsRepository
      .createQueryBuilder('channel')
      .innerJoinAndSelect('channel.chatUsers', 'user', 'user.id = :userId', {
        userId,
      })
      .leftJoinAndSelect('channel.chatOwner', 'owner')
      .where('channel.chatType = :chatType', { chatType: chatType.DIRECT })
      .getMany();

    if (channels.length < 1) return null;

    return channels.map((chanel) => plainToClass(ChannelsEntity, chanel));
    // const channelsDTOs = plainToClass(ReturnChanelDto, channels);

    // return channelsDTOs;
  }

  async getOwnerById(chatId: number): Promise<ChatUserDto> {
    const chat = await this.channelsRepository.findOne({
      where: { chatId: chatId },
      relations: ['chatOwner'],
    });

    if (!chat) throw new NotFoundException('Chat not found');
    return plainToClass(ChatUserDto, chat.chatOwner);
  }

  async findAllUsers(chatId: number): Promise<ChatUserDto[]> {
    const chat = await this.channelsRepository
      .createQueryBuilder('chat')
      .leftJoinAndSelect('chat.chatUsers', 'users')
      .where('chat.chatId = :chatId', { chatId })
      .leftJoinAndSelect('chat.chatOwner', 'owner')
      .getOne();

    if (!chat) {
      throw new NotFoundException(`Chat with ID ${chatId} not found`);
    }

    return chat.chatUsers.map((user) => plainToClass(ChatUserDto, user));
  }

  async findAllAdmins(chatId: number): Promise<ChatUserDto[] | null> {
    const chat = await this.channelsRepository
      .createQueryBuilder('chat')
      .leftJoinAndSelect('chat.chatAdmins', 'users')
      .where('chat.chatId = :chatId', { chatId })
      .getOne();

    if (!chat) {
      throw new Error(`Chat with ID ${chatId} not found`);
    }
    if (chat.chatAdmins.length < 1) return null;
    // return plainToClass(ChatUserDto, chat.chatAdmins);

    return chat.chatAdmins.map((admin) => plainToClass(ChatUserDto, admin));
  }

  async addUserToChat(chatId: number, userId: number): Promise<ChatUserDto[]> {
    const chat = await this.channelsRepository.findOne({
      where: { chatId: chatId },
      relations: ['chatUsers'],
    });

    const existingUser = await this.userRepository.findOne({
      where: { id: userId },
    });
    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }
    if (chat.chatUsers.find((userA) => userA.id == userId))
      throw new ForbiddenException(`User already exist in this chat`);
    if (chat.chatUsers.length >= chat.maxUsers && chat.maxUsers != null)
      throw new ForbiddenException(
        'Chat is full plese extend ur channel or remove user from it',
      );
    if (!chat.chatUsers) {
      chat.chatUsers = [];
      chat.chatUsers.push(chat.chatOwner);
    }
    chat.chatUsers.push(existingUser);

    await this.channelsRepository.save(chat);
    return chat.chatUsers;
  }

  async removeUserFromChat(
    chatId: number,
    userId: number,
  ): Promise<ChatUserDto[] | null> {
    const chat = await this.channelsRepository.findOne({
      where: { chatId: chatId },
      relations: ['chatUsers', 'chatOwner'],
    });

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }
    const userRemove = chat.chatUsers.find((user) => user.id == userId);

    if (!userRemove) {
      throw new NotFoundException('User not found in this chat');
    }

    chat.chatUsers = chat.chatUsers.filter((user) => user.id != userId);

    const newChat = await this.channelsRepository.save(chat);

    if (newChat.chatUsers.length < 1) return null;
    return newChat.chatUsers.map((user) => plainToClass(ChatUserDto, user));
  }

  async addAdminToChat(chatId: number, userId: number): Promise<ChatUserDto[]> {
    const chat = await this.channelsRepository.findOne({
      where: { chatId: chatId },
      relations: ['chatAdmins'],
    });

    if (!(await this.userRepository.findOne({ where: { id: userId } }))) {
      throw new NotFoundException('User not found');
    }
    if (!chat) {
      throw new NotFoundException('Chat not found');
    }
    if (chat.chatAdmins.length < 1) {
      chat.chatAdmins = [];
    }
    const user = await this.userRepository.findOne({ where: { id: userId } });
    chat.chatAdmins.push(user);
    await this.channelsRepository.save(chat);
    return chat.chatAdmins.map((user) => plainToClass(ChatUserDto, user));
  }

  async removeAdminFromChat(
    chatId: number,
    adminId: number,
  ): Promise<ChatUserDto[] | null> {
    const chat = await this.channelsRepository.findOne({
      where: { chatId: chatId },
      relations: ['chatAdmins', 'chatOwner'],
    });

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }
    const adminToRemove = chat.chatAdmins.find((admin) => admin.id == adminId);

    if (!adminToRemove) {
      throw new NotFoundException('Admin not found in this chat');
    }

    chat.chatAdmins = chat.chatAdmins.filter((admin) => admin.id != adminId);

    await this.channelsRepository.save(chat);

    if (chat.chatAdmins.length < 1) return null;
    return this.findAllAdmins(chatId);
  }

  async addBannedUserToChat(
    chatId: number,
    bannedId: number,
    adminId: number,
    reason: string,
  ): Promise<void> {
    await this.bannedService.createBanned(chatId, bannedId, adminId, reason);
  }

  async createMessage(
    chatId: number,
    message: string,
    userId: number,
  ): Promise<ReturnMessageDto> {
    return await this.messageService.createMessage(chatId, message, userId);
  }

  async getAllMessages(
    chatId: number,
  ): Promise<ReturnMessageDto[] | undefined> {
    return await this.messageService.findAllMessagesByChannel(chatId);
  }

  async updateMessage(
    messageId: number,
    message: string,
  ): Promise<ReturnMessageDto> {
    return await this.messageService.updateMessage(messageId, message);
  }

  async deleteMessage(
    messageId: number,
    chatId: number,
  ): Promise<ReturnMessageDto[]> {
    return await this.messageService.deleteMessage(messageId, chatId);
  }

  async muteUser(
    userId: number,
    channelId: number,
    mutedById: number,
    mutedUntil?: Date | null,
  ): Promise<ReturnMutedDto[]> {
    return await this.mutedService.createMuted(
      userId,
      channelId,
      mutedById,
      mutedUntil,
    );
  }

  async getMute(chatId: number): Promise<ReturnMutedDto[]> {
    return await this.mutedService.findAllMutedAtChat(chatId);
  }

  async unMute(mutedId: number, chatId: number): Promise<ReturnMutedDto[]> {
    return await this.mutedService.deleteMuted(mutedId, chatId);
  }

  async muteUpdated(
    muteId: number,
    chatId: number,
    muteDate?: Date | null,
  ): Promise<ReturnMutedDto[]> {
    return await this.mutedService.updateMuted(muteId, muteDate, chatId);
  }

  async joinChannel(channelId: number, userId: number): Promise<ChatUserDto[]> {
    const chat = await this.channelsRepository.findOne({
      where: { chatId: channelId },
      relations: ['activeUsers', 'bannedUsers'],
    });
    if (!chat) {
      throw new NotFoundException('Chat not found');
    }
    const existingUser = await this.userRepository.findOne({
      where: { id: userId },
    });
    if (!existingUser) {
      throw new NotFoundException('User not found');
    }
    const isUserBanned = chat.bannedUsers.some(
      (bannedUser) => bannedUser.id == userId,
    );
    if (isUserBanned) {
      throw new ForbiddenException('User is banned in this channel');
    }
    if (!chat.activeUsers) {
      chat.activeUsers = [];
    }
    chat.activeUsers.push(existingUser);

    await this.channelsRepository.save(chat);
    return await this.getActiveUsers(channelId);
  }

  async quitChannel(channelId: number, userId: number): Promise<ChatUserDto[]> {
    const chat = await this.channelsRepository.findOne({
      where: { chatId: channelId },
      relations: ['activeUsers'],
    });
    if (!chat) {
      throw new NotFoundException('Chat not found');
    }
    if (!(await this.userRepository.findOne({ where: { id: userId } }))) {
      throw new NotFoundException('User not found');
    }
    await this.channelsRepository
      .createQueryBuilder()
      .relation(ChannelsEntity, 'activeUsers')
      .of(chat)
      .remove(userId);

    chat.activeUsers = chat.chatAdmins.filter((user) => user.id != userId);

    if (chat.activeUsers.length < 1) chat.activeUsers = null;
    await this.channelsRepository.save(chat);
    return await this.getActiveUsers(channelId);
  }

  async getActiveUsers(channelId: number): Promise<ChatUserDto[] | null> {
    const chat = await this.channelsRepository.findOne({
      where: { chatId: channelId },
      relations: ['activeUsers'],
    });

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }
    if (chat.activeUsers.length < 1) return null;

    return chat.activeUsers.map((user) => plainToClass(ChatUserDto, user));
  }

  async getPassword(chatId: number): Promise<string> {
    const chat = await this.channelsRepository.findOne({
      where: { chatId: chatId },
    });
    return chat.password;
  }
}