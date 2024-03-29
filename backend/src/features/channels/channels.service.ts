import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, Equal } from 'typeorm';
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
import { ReturnMutedDto } from '@backend/features/muted/dto/return-muted.dto';
import * as bcrypt from 'bcryptjs';
import { BannedService } from '../banned/banned.service';
import { MessagesService } from '../messages/messages.service';
import { MutedService } from '@backend/features/muted/muted.service';
import { ReturnMessageDto } from '../messages/dto/return-message.dto';

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

    if (channels.length < 1) return [];
    return channels.map(chanel => plainToClass(ChannelsEntity, chanel));
  }

  async inviteUserToChat(
    userName: string,
    chatId: number,
  ): Promise<ChatUserDto[]> {
    const user = await this.userRepository.findOne({
      where: { displayName: userName },
    });
    if (!user) throw new NotFoundException('User not found');
    const chat = await this.channelsRepository.findOne({
      where: { chatId: chatId },
    });
    if (!chat) throw new NotFoundException('Chat not found');

    chat.chatUsers.push(user);
    await this.channelsRepository.save(chat);
    return chat.chatUsers.map(user => plainToClass(ChatUserDto, user));
  }

  // async findAllUserChannels(userId: number): Promise<ChannelsEntity[]> {
  //   const channels = await this.channelsRepository
  //     .createQueryBuilder('channel')
  //     .innerJoinAndSelect('channel.chatUsers', 'user')
  //     .leftJoinAndSelect('channel.chatOwner', 'owner')
  //     .where('user.id = :userId', { userId })
  //     .orWhere('owner.id = :userId', { userId })
  //     .getMany();
  //   return channels;
  // }

  async findAllUserChannels(userId: number): Promise<ChannelsEntity[]> {
    const channelIds = await this.channelsRepository
      .createQueryBuilder('channel')
      .leftJoin('channel.chatUsers', 'user')
      .leftJoin('channel.chatOwner', 'owner')
      .select('channel.chatId')
      .where('user.id = :userId', { userId })
      .orWhere('owner.id = :userId', { userId })
      .getMany();

    const ids = channelIds.map(channel => channel.chatId);

    if (ids.length > 0) {
      const channels = await this.channelsRepository
        .createQueryBuilder('channel')
        .leftJoinAndSelect('channel.chatUsers', 'user')
        .leftJoinAndSelect('channel.chatOwner', 'owner')
        .whereInIds(ids)
        .getMany();

      return channels;
    }

    return [];
  }

  async findAllPublicChannels(): Promise<ChannelsEntity[]> {
    const channels = await this.channelsRepository
      .createQueryBuilder('channel')
      .where('channel.chatType = :chatType', { chatType: 'public' })
      .leftJoinAndSelect('channel.chatOwner', 'owner')
      .getMany();

    if (channels.length < 1) return [];

    return channels.map(chanel => plainToClass(ChannelsEntity, chanel));
  }

  async findOneById(id: number): Promise<ChannelsEntity> {
    const channel = await this.channelsRepository.findOne({
      where: { chatId: id },
      relations: ['chatOwner', 'chatUsers'],
    });
    if (!channel) throw new NotFoundException('channelNotFound');
    return plainToClass(ChannelsEntity, channel);
  }

  async addUserToProtectedChat(
    chatName: string,
    password: string,
    userId: number,
  ): Promise<ChatUserDto[]> {
    const channel = await this.channelsRepository.findOne({
      where: { chatName: chatName, chatType: chatType.PROTECTED },
      relations: ['chatUsers', 'bannedUsers', 'bannedUsers.bannedUser'],
    });
    if (!channel) throw new NotFoundException('channelNotFound');
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('userNotFound');
    if (channel.bannedUsers.find(user => user.bannedUser.id == userId))
      throw new ForbiddenException(`User is banned from this chat`);
    if (channel.chatUsers.find(userA => userA.id == userId))
      throw new ForbiddenException(`User already exist in this chat`);
    channel.chatUsers.push(user);

    if (channel.bannedUsers.find(userA => userA.id == userId))
      throw new ForbiddenException(`User is banned in this chat`);
    // check if password is correct
    const isPasswordCorrect = await bcrypt.compare(password, channel.password);

    if (!isPasswordCorrect) {
      throw new ForbiddenException('incorrect password');
    }

    await this.channelsRepository.save(channel);
    return channel.chatUsers.map(user => plainToClass(ChatUserDto, user));
  }

  async addUserToPublicChat(
    chatId: number,
    userId: number,
  ): Promise<ChatUserDto[]> {
    const channel = await this.channelsRepository.findOne({
      where: { chatId: chatId, chatType: chatType.PUBLIC },
      relations: ['chatUsers', 'bannedUsers', 'bannedUsers.bannedUser'],
    });
    if (!channel) throw new NotFoundException('channelNotFound');

    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) throw new NotFoundException('User not found');

    if (channel.bannedUsers.find(userA => userA.id == userId))
      throw new ForbiddenException(`User is banned in this chat`);
    if (
      channel.bannedUsers.find(
        bannedEntry => bannedEntry.bannedUser.id == userId,
      )
    ) {
      throw new ForbiddenException('User is banned at this channel');
    }
    if (channel.chatUsers.find(userA => userA.id == userId))
      throw new ForbiddenException(`User already exist in this chat`);
    channel.chatUsers.push(user);
    await this.channelsRepository.save(channel);
    return channel.chatUsers.map(user => plainToClass(ChatUserDto, user));
  }

  async addUserToProtectedChatId(
    chatName: string,
    userId: number,
  ): Promise<ChatUserDto[]> {
    const channel = await this.channelsRepository.findOne({
      where: { chatName: chatName },
      relations: ['chatUsers', 'bannedUsers', 'bannedUsers.bannedUser'],
    });
    if (!channel) throw new NotFoundException('channelNotFound');
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('userNotFound');
    if (channel.bannedUsers.find(userA => userA.id == userId))
      throw new ForbiddenException(`User is banned from this chat`);
    if (
      channel.bannedUsers.find(
        bannedEntry => bannedEntry.bannedUser.id == userId,
      )
    ) {
      throw new ForbiddenException('User is banned at this channel');
    }
    if (channel.chatUsers.find(userA => userA.id == userId))
      throw new ForbiddenException(`User already exist in this chat`);
    channel.chatUsers.push(user);
    await this.channelsRepository.save(channel);
    return channel.chatUsers.map(user => plainToClass(ChatUserDto, user));
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

    const salt = await bcrypt.genSalt();

    const newChannel = new ChannelsEntity();
    newChannel.chatUsers = [];
    newChannel.chatUsers.push(owner);
    newChannel.chatName = dto.chatName;
    newChannel.chatOwner = owner;
    if (!!dto.password) {
      newChannel.password = await bcrypt.hash(dto.password, salt);
    } else {
      newChannel.password = null;
    }
    newChannel.maxUsers = dto.maxUsers || null;
    newChannel.chatType = dto.chatType;

    const chanel = await this.channelsRepository.save(newChannel);
    // return plainToClass(ReturnChanelDto, chanel);
    return plainToClass(ChannelsEntity, chanel);
  }

  async createDm(user1: number, user2: number): Promise<ChannelsEntity> {
    const owner = await this.userRepository.findOne({
      where: { id: user1 },
    });
    if (!owner) {
      throw new NotFoundException(`User ${owner?.displayName} not found`);
    }
    const user = await this.userRepository.findOne({
      where: { id: user2 },
    });
    if (!user) {
      throw new NotFoundException(`User ${user?.displayName} not found`);
    }
    const chatName = owner.intraId + ' | ' + user.intraId;
    const existingChannel = await this.channelsRepository.findOne({
      where: { chatName: chatName, chatType: chatType.DIRECT },
    });
    if (existingChannel) {
      throw new ForbiddenException(
        'Ypu already have conversation with this user',
      );
    }

    const newChannel = new ChannelsEntity();
    newChannel.chatUsers = [];
    newChannel.chatUsers.push(owner);
    newChannel.chatUsers.push(user);
    newChannel.chatName = chatName;
    newChannel.chatOwner = owner;
    newChannel.password = null;
    newChannel.maxUsers = 2;
    newChannel.chatType = chatType.DIRECT;

    const chanel = await this.channelsRepository.save(newChannel);
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

    await this.channelsRepository.remove(chat);

    return await this.findAll();
  }

  // async update(chatId: number, dto: UpdateChannelDto): Promise<ChannelsEntity> {
  //   const chat = await this.channelsRepository.findOne({
  //     where: { chatId: chatId },
  //   });
  //   if (!chat) throw new NotFoundException('Channel not found');

  //   if (
  //     await this.channelsRepository.findOne({
  //       where: { chatName: dto.chatName },
  //     })
  //   )
  //     throw new ForbiddenException(
  //       `Channle with name ${dto.chatName} already exist`,
  //     );
  //   if (dto.chatName != null) {
  //     chat.chatName = dto.chatName;
  //   }

  //   if (dto.password != null) {
  //     chat.password = dto.password;
  //   }

  //   if (dto.maxUsers != null) {
  //     chat.maxUsers = dto.maxUsers;
  //   }

  //   if (dto.chatType !+ null)
  //     chat.chatType = dto.chatType;

  //   if (chat.password != null && dto.password == null) chat.password = null;

  //   const updatedChat = await this.channelsRepository.save(chat);

  //   return plainToClass(ChannelsEntity, updatedChat);
  // }

  async update(
    chatId: number,
    dto: UpdateChannelDto,
    authUser: number,
  ): Promise<ChannelsEntity> {
    const chat = await this.channelsRepository.findOne({
      where: { chatId },
      relations: ['chatOwner'],
    });
    if (!chat) throw new NotFoundException('Channel not found');
    if (chat.chatOwner.id != authUser)
      throw new ForbiddenException(
        ' Only chat owner can update channel. User is not chat owner',
      );
    if (dto.chatName) {
      const existingChannel = await this.channelsRepository.findOne({
        where: { chatName: dto.chatName, chatId: Not(Equal(chatId)) },
      });
      if (existingChannel) {
        throw new ForbiddenException(
          `Channel with name ${dto.chatName} already exists`,
        );
      }
    }

    chat.chatName = dto.chatName ?? chat.chatName;
    chat.password = dto.password ?? chat.password;
    chat.maxUsers = dto.maxUsers ?? chat.maxUsers;
    chat.chatType = dto.chatType ?? chat.chatType;

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

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (channels.length < 1) return [];

    return channels.map(chanel => plainToClass(ChannelsEntity, chanel));
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
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) throw new NotFoundException('User not found');
    if (channels.length < 1) return [];

    return channels.map(chanel => plainToClass(ChannelsEntity, chanel));
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
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) throw new NotFoundException('User not found');
    if (channels.length < 1) return [];

    return channels.map(chanel => plainToClass(ChannelsEntity, chanel));
  }

  async getOwnerById(chatId: number): Promise<ChatUserDto> {
    const chat = await this.channelsRepository.findOne({
      where: { chatId: chatId },
      relations: ['chatOwner', 'chatUsers'],
    });

    if (!chat) throw new NotFoundException('Chat not found');
    return plainToClass(ChatUserDto, chat.chatOwner);
  }

  async findAllUsers(chatId: number, authUser: number): Promise<ChatUserDto[]> {
    const chat = await this.channelsRepository
      .createQueryBuilder('chat')
      .where('chat.chatId = :chatId', { chatId })
      .leftJoinAndSelect('chat.chatOwner', 'owner')
      .leftJoinAndSelect('chat.chatUsers', 'users')
      .leftJoinAndSelect('chat.chatAdmins', 'admins')
      .getOne();
    if (!chat) {
      throw new NotFoundException(`Chat with ID ${chatId} not found`);
    }
    if (!chat.chatUsers.find(user => user.id === authUser)) {
      throw new ForbiddenException('User not in this channel');
    }

    return chat.chatUsers.map(user => {
      const userDto = plainToClass(ChatUserDto, user);
      if (user.id === chat.chatOwner.id) {
        userDto.role = 'owner';
      } else if (chat.chatAdmins.some(admin => admin.id === user.id)) {
        userDto.role = 'admin';
      } else {
        userDto.role = 'user';
      }
      // Logger.log(userDto);
      return userDto;
    });
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

    return chat.chatAdmins.map(admin => plainToClass(ChatUserDto, admin));
  }

  async addUserToChat(chatId: number, userId: number): Promise<ChatUserDto[]> {
    const chat = await this.channelsRepository.findOne({
      where: { chatId: chatId },
      relations: ['chatUsers', 'bannedUsers', 'bannedUsers.bannedUser'],
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
    if (chat.bannedUsers.find(user => user.bannedUser.id == userId))
      throw new ForbiddenException(`User is banned from this chat`);
    if (chat.chatUsers.find(userA => userA.id == userId))
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
    return chat.chatUsers.map(user => plainToClass(ChatUserDto, user));
  }

  async addUserToChatByName(
    chatId: number,
    userName: string,
    authUser: number,
  ): Promise<ChatUserDto[]> {
    const chat = await this.channelsRepository.findOne({
      where: { chatId: chatId },
      relations: ['chatUsers', 'bannedUsers', 'bannedUsers.bannedUser'],
    });
    if (!chat) {
      throw new NotFoundException('Chat not found');
    }
    const user = await this.userRepository.findOne({
      where: { id: authUser },
    });
    const existingUser = await this.userRepository.findOne({
      where: { displayName: userName },
    });
    if (!existingUser) {
      throw new NotFoundException('User not found');
    }
    // if (chat.bannedUsers.find((user) => user.bannedUser.id === user.id))
    //   throw new ForbiddenException(`User is banned from this chat`);
    if (
      chat.bannedUsers.find(
        bannedEntry => bannedEntry.bannedUser.id == existingUser.id,
      )
    ) {
      throw new ForbiddenException('User is banned at this channel');
    }
    if (chat.chatUsers.find(userA => userA.id == existingUser.id))
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
    return chat.bannedUsers.map(user => plainToClass(ChatUserDto, user));
  }

  async removeUserFromChat(
    chatId: number,
    userId: number,
    authUser: number,
  ): Promise<ChatUserDto[] | null> {
    const chat = await this.channelsRepository.findOne({
      where: { chatId: chatId },
      relations: ['chatUsers', 'chatOwner', 'chatAdmins'],
    });

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }
    if (userId === chat.chatOwner.id)
      throw new ForbiddenException(`You can't remove owner from chat`);
    if (
      chat.chatOwner.id != authUser ||
      (chat.chatAdmins.find(admin => (admin.id == authUser) == false) &&
        chat.chatOwner.id != authUser)
    )
      throw new ForbiddenException(
        `Only owner or admin can remove user from chat`,
      );
    const userRemove = chat.chatUsers.find(user => user.id == userId);

    if (!userRemove) {
      throw new NotFoundException('User not found in this chat');
    }

    if (
      chat.chatAdmins.find(admin => admin.id == userId) &&
      chat.chatOwner.id == authUser
    ) {
      //remove from admin
      this.removeAdminFromChat(chatId, userId, authUser);
    }

    chat.chatUsers = chat.chatUsers.filter(user => user.id != userId);

    const newChat = await this.channelsRepository.save(chat);

    if (newChat.chatUsers.length < 1) return [];
    // Logger.log(`User removed from chat`);
    return newChat.chatUsers.map(user => plainToClass(ChatUserDto, user));
  }

  async removeSelfFromChat(
    chatId: number,
    authUser: number,
  ): Promise<ChatUserDto[] | null> {
    const chat = await this.channelsRepository.findOne({
      where: { chatId: chatId },
      relations: ['chatUsers', 'chatOwner', 'chatAdmins'],
    });

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }
    const userRemove = chat.chatUsers.find(user => user.id == authUser);

    if (!userRemove) {
      throw new NotFoundException('User not found in this chat');
    }

    await this.channelsRepository
      .createQueryBuilder()
      .relation(ChannelsEntity, 'activeUsers')
      .of(chat)
      .remove(authUser);

    if (chat.chatAdmins.find(admin => admin.id == authUser)) {
      //remove from admin
      this.removeAdminFromChat(chatId, authUser, authUser);
    }

    chat.chatUsers = chat.chatUsers.filter(user => user.id != authUser);

    if (chat.chatOwner.id === authUser) {
      let newOwner;
      if (chat.chatAdmins.length > 0) {
        newOwner = chat.chatAdmins[0];
      } else if (chat.chatUsers.length > 0) {
        newOwner = chat.chatUsers.find(u => u.id !== authUser);
      }

      if (newOwner) {
        chat.chatOwner = newOwner;
      } else {
        await this.delete(chat.chatId, authUser);
        // Logger.log(chat.chatName + ' is deleted');
        return [];
      }
    }

    const newChat = await this.channelsRepository.save(chat);

    if (newChat.chatUsers.length < 1) return [];
    // Logger.log(`User removed from chat`);
    return newChat.chatUsers.map(user => plainToClass(ChatUserDto, user));
  }

  async addAdminToChat(
    chatId: number,
    userId: number,
    authUser: number,
  ): Promise<ChatUserDto[]> {
    const chat = await this.channelsRepository.findOne({
      where: { chatId: chatId },
      relations: ['chatAdmins', 'chatOwner'],
    });
    if (chat.chatOwner.id != authUser)
      throw new ForbiddenException(`Only owner can add admin to chat`);
    if (chat.chatAdmins.find(admin => admin.id == userId)) {
      throw new ForbiddenException('User already an admin');
    }
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
    return chat.chatAdmins.map(user => plainToClass(ChatUserDto, user));
  }

  async removeAdminFromChat(
    chatId: number,
    adminId: number,
    authUser: number,
  ): Promise<ChatUserDto[] | null> {
    const chat = await this.channelsRepository.findOne({
      where: { chatId: chatId },
      relations: ['chatAdmins', 'chatOwner'],
    });

    if (chat.chatOwner.id != authUser)
      throw new ForbiddenException(`Only owner can remove admin from chat`);
    if (!chat) {
      throw new NotFoundException('Chat not found');
    }
    const adminToRemove = chat.chatAdmins.find(admin => admin.id == adminId);

    if (!adminToRemove) {
      throw new NotFoundException('Admin not found in this chat');
    }

    chat.chatAdmins = chat.chatAdmins.filter(admin => admin.id != adminId);

    await this.channelsRepository.save(chat);

    if (chat.chatAdmins.length < 1) return [];
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
    authUser: number,
  ): Promise<ReturnMessageDto[] | undefined> {
    return await this.messageService.findAllMessagesByChannel(chatId, authUser);
  }

  // async updateMessage(
  //   messageId: number,
  //   message: string,
  //   autUser: number,
  // ): Promise<ReturnMessageDto> {
  //   return await this.messageService.updateMessage(messageId, message, autUser);
  // }

  // async deleteMessage(
  //   messageId: number,
  //   chatId: number,
  //   autUser: number,
  // ): Promise<ReturnMessageDto[]> {
  //   return await this.messageService.deleteMessage(messageId, chatId, autUser);
  // }

  async muteUser(
    userId: number,
    channelId: number,
    mutedById: number,
    mutedUntil?: Date | null,
  ): Promise<ReturnMutedDto[]> {
    // check if user is in chat
    const chat = await this.channelsRepository.findOne({
      where: { chatId: channelId },
      relations: ['chatUsers'],
    });

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!chat.chatUsers.some(user => user.id === userId)) {
      throw new ForbiddenException('User not in this channel');
    }

    const muteSession = await this.mutedService.findMutedByUserId(
      userId,
      channelId,
    );

    if (muteSession) {
      return this.mutedService.updateMuted(
        muteSession.id,
        mutedUntil,
        channelId,
        mutedById,
      );
    }

    return await this.mutedService.createMuted(
      userId,
      channelId,
      mutedById,
      mutedUntil,
    );
  }

  async getMute(chatId: number, authUser: number): Promise<ReturnMutedDto[]> {
    return await this.mutedService.findAllMutedAtChat(chatId, authUser);
  }

  async unMute(
    userId: number,
    chatId: number,
    authUser: number,
  ): Promise<ReturnMutedDto[]> {
    return await this.mutedService.deleteMuted(userId, chatId, authUser);
  }

  async muteUpdated(
    muteId: number,
    chatId: number,
    authUser: number,
    muteDate?: Date | null,
  ): Promise<ReturnMutedDto[]> {
    return await this.mutedService.updateMuted(
      muteId,
      muteDate,
      chatId,
      authUser,
    );
  }

  async joinChannel(
    channelId: number,
    userId: number,
    password?: string,
  ): Promise<ChatUserDto[]> {
    const chat = await this.channelsRepository.findOne({
      where: { chatId: channelId },
      relations: ['activeUsers', 'bannedUsers', 'chatUsers'],
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
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });
    const isUserBanned = chat.bannedUsers.some(
      bannedUser => bannedUser.id == userId,
    );
    if (isUserBanned) {
      throw new ForbiddenException('User is banned in this channel');
    }
    if (chat.bannedUsers.find(user => user.id == userId)) {
      throw new ForbiddenException('User is banned in this channel');
    }
    if (chat.password != null) {
      if (!(await bcrypt.compare(password, chat.password)))
        throw new ForbiddenException('Password is wrong!!');
    }
    if (
      chat.chatType != 'public' &&
      chat.chatUsers.some(user => user.id === userId)
    ) {
      throw new ForbiddenException('U are not in this chat');
    }
    chat.chatUsers.push(existingUser);
    await this.channelsRepository.save(chat);
    return await this.getActiveUsers(channelId);
  }

  async quitChannel(channelId: number, userId: number): Promise<ChatUserDto[]> {
    const chat = await this.channelsRepository.findOne({
      where: { chatId: channelId },
      relations: ['activeUsers', 'chatOwner', 'chatAdmins', 'chatUsers'],
    });

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.channelsRepository
      .createQueryBuilder()
      .relation(ChannelsEntity, 'activeUsers')
      .of(chat)
      .remove(userId);

    if (chat.chatOwner.id === userId) {
      let newOwner;
      if (chat.chatAdmins.length > 0) {
        newOwner = chat.chatAdmins[0];
      } else if (chat.chatUsers.length > 0) {
        newOwner = chat.chatUsers.find(u => u.id !== userId);
      }

      if (newOwner) {
        chat.chatOwner = newOwner;
      } else {
        await this.delete(chat.chatId, userId);
        // Logger.log(chat.chatName + ' is deleted');
        return [];
      }
    }

    await this.channelsRepository.save(chat);

    if (chat.chatOwner.id === userId) {
      throw new ForbiddenException(
        'Please set new owner before quitting the chat',
      );
    }

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

    return chat.activeUsers.map(user => plainToClass(ChatUserDto, user));
  }

  // async getPassword(chatId: number): Promise<string> {
  //   const chat = await this.channelsRepository.findOne({
  //     where: { chatId: chatId },
  //   });
  //   return chat.password;
  // }
}
