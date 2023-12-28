import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  NotFoundException,
  Logger,
  HttpStatus,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ChannelsService } from './channels.service';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
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
import { ChannelCreatedTO } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';
import { ChatUserDto } from './dto/chat-user.dto';
import { BanUserDto } from '@backend/banned/dto/ban-user.dto';
import { ReturnMessageDto } from '@backend/messages/dto/return-message.dto';
import { UpdateMessageDto } from '@backend/messages/dto/update-message.dto';
import { CreateMessageDto } from '@backend/messages/dto/create-message.dto';
import { ReturnMutedDto } from '@backend/muted/dto/return-muted.dto';
import { MutedService } from '@backend/muted/muted.service';
import { BannedService } from '@backend/banned/banned.service';
import { MessagesService } from '@backend/messages/messages.service';
import { ReturnBannedDto } from '@backend/banned/dto/return-ban.dto';
import { CreateMuteDto } from '@backend/muted/dto/create-muted.dto';
import { UpdateMuteDto } from '@backend/muted/dto/update-mute.dto';
import { XKeyGuard } from '@backend/shared/x-key.guard';
import { AuthGuard } from '@backend/shared/auth.guard';
import { SocketGateway } from '@backend/gateWay/chat.gateway';
import { AuthUser } from '@backend/pipe/auth-user.decorator';
import { AuthUser as AuthUserInterface } from '@backend/interfaces/auth-user.interface';
import { PaginationDto } from '@backend/messages/dto/pagination.dto';
import { dmCreate } from './dto/dm.dto';
import {
  addUserByName,
  adminRemove,
  chatD,
  chatDelete,
  chatId,
  messageRem,
  muteD,
  userId,
} from './dto/userId.dto';
import { chatType } from '@backend/typeorm/channel.entity';

@Controller('channels')
@UseGuards(XKeyGuard, AuthGuard)
@ApiBearerAuth()
@ApiSecurity('x-api-key')
@ApiTags('Channels')
export class ChannelsController {
  constructor(
    private readonly channelsService: ChannelsService,
    @InjectRepository(User)
    @InjectRepository(BannedEntity)
    @InjectRepository(MutedEntity)
    private readonly mutedService: MutedService,
    private readonly bannedService: BannedService,
    private readonly messageService: MessagesService,
    private readonly chatGateway: SocketGateway,
  ) {}

  @Get('all')
  async findAll(): Promise<ChannelsEntity[]> {
    return this.channelsService.findAll();
  }

  @Get(':userId/all')
  @ApiOperation({ summary: 'get all of user channels by user Id.' })
  @ApiParam({ name: 'userId', type: Number, example: 1 })
  async findUserChats(
    @AuthUser() authUser: AuthUserInterface,
    @Param('userId') userId: number,
  ): Promise<ChannelsEntity[]> {
    Logger.log(authUser);
    return this.channelsService.findAllUserChannels(authUser.user.id);
  }

  @Get('public')
  @ApiOperation({ summary: 'get all public channels' })
  async findPublic(): Promise<ChannelsEntity[]> {
    return this.channelsService.findAllPublicChannels();
  }

  @Get('usersPrivate/:userId')
  @ApiOperation({ summary: 'get all of user private channels by user Id.' })
  @ApiParam({ name: 'userId', type: Number, example: 1 })
  async findPrivate(
    @AuthUser() authUser: AuthUserInterface,
    @Param('userId') userId: number,
    // @Body() dto: userId,
  ): Promise<ChannelsEntity[]> {
    return this.channelsService.findUserPrivateChats(authUser.user.id);
  }

  @Get('usersProtect/:userId')
  @ApiOperation({ summary: 'get all of user protected channels by user Id.' })
  @ApiParam({ name: 'userId', type: Number, example: 1 })
  async findPotected(
    @Param('userId') userId: number,
    @AuthUser() authUser: AuthUserInterface,
  ): Promise<ChannelsEntity[]> {
    return this.channelsService.findUserProtectedChats(authUser.user.id);
  }

  @Get('usersDm/:userId')
  @ApiOperation({ summary: 'get all of user dm channels by user Id.' })
  @ApiParam({ name: 'userId', type: Number, example: 1 })
  async findDm(
    @AuthUser() authUser: AuthUserInterface,
    @Param('userId') userId: number,
  ): Promise<ChannelsEntity[]> {
    return this.channelsService.findUserDmChats(authUser.user.id);
  }

  @Get(':chatId')
  @ApiOperation({ summary: 'get one channel by Id.' })
  @ApiParam({ name: 'chatId', type: Number, example: 1 })
  async findOne(
    @Param('chatId') chatId: number,
    // @AuthUser() authUser: AuthUserInterface,
  ): Promise<ChannelsEntity> {
    return this.channelsService.findOneById(chatId);
  }

  @Get(':chatId/owner')
  @ApiOperation({ summary: 'get one channel owner by chat Id.' })
  @ApiParam({ name: 'chatId', type: Number, example: 1 })
  async owner(@Param('chatId') chatId: number): Promise<ChatUserDto> {
    const owner = await this.channelsService.getOwnerById(chatId);
    if (!owner) throw new NotFoundException('UserNotFound');
    return owner;
  }

  @Post('create')
  @ApiOperation({ summary: 'get one channel owner by chat Id.' })
  @ApiBody({
    description: 'Channel creation data',
    type: ChannelCreatedTO,
    examples: {
      NormalRequest: {
        summary: 'A normal example',
        value: {
          chatName: 'Example chat',
          hatOwner: 23,
          password: 'aaasssddd',
          maxUsers: null,
          chatType:
            chatType.PUBLIC ||
            chatType.DIRECT ||
            chatType.PROTECTED ||
            chatType.PRIVATE,
        },
      },
    },
  })
  async create(
    @AuthUser() authUser: AuthUserInterface,
    @Body() dto: ChannelCreatedTO,
  ): Promise<ChannelsEntity> {
    this.chatGateway.sendEvents('chat created');
    dto.chatOwner = authUser.user.id;
    return this.channelsService.create(dto);
  }

  @Post('createDm')
  @ApiOperation({
    summary: 'create direct messages',
    description:
      'by default max_users will be set as 2 and chatType will be set as direct',
  })
  @ApiBody({
    description: 'Direct messages creation data',
    type: dmCreate,
    examples: {
      NormalRequest: {
        summary: 'A normal example',
        value: {
          user1: 1,
          user2: 2,
        },
      },
    },
  })
  async createDm(@Body() dto: dmCreate): Promise<ChannelsEntity> {
    this.chatGateway.sendEvents('dmCreated'),
      { user1: dto.user1, user2: dto.user2 };
    return this.channelsService.createDm(dto.user1, dto.user2);
  }

  @Post(':chatId/delete/:userId')
  @ApiOperation({
    summary: 'delete chat',
    description:
      'gets chat Id and Id of user who trying to delete the chat (will be changed when we get userSession)',
  })
  @ApiParam({
    name: 'chatId',
    type: Number,
    description: 'The ID of the chat',
    example: 23,
  })
  @ApiParam({
    name: 'userId',
    type: Number,
    description: 'The ID of the user',
    example: 42,
  })
  async deleteChat(
    @AuthUser() authUser: AuthUserInterface,
    @Param('chatId') chatId: number,
    @Param('userId') userId: number,
  ): Promise<ChannelsEntity[]> {
    this.chatGateway.sendEvents({ messge: 'chat deleted', chatId: chatId });
    return await this.channelsService.delete(chatId, authUser.user.id);
  }

  @Post(':chatId/update')
  @ApiOperation({
    summary: 'update chat',
    description:
      'gets Id of chat that need to be updadet and data with new values(if data is null params not changed)',
  })
  @ApiParam({
    name: 'chatId',
    type: Number,
    description: 'The ID of the chat',
    example: 42,
  })
  @ApiBody({
    description: 'Direct messages creation data',
    type: UpdateChannelDto,
    examples: {
      NormalRequest: {
        summary: 'A normal example',
        value: {
          chatName: 'Updated chat',
          password: 'updated password',
          max_users: 23,
          chatType:
            chatType.PROTECTED ||
            chatType.PUBLIC ||
            chatType.DIRECT ||
            chatType.PRIVATE,
        },
      },
    },
  })
  async update(
    @AuthUser() authUser: AuthUserInterface,
    @Param('chatId') chatId: number,
    @Body() dto: UpdateChannelDto,
  ): Promise<ChannelsEntity> {
    this.chatGateway.sendEvents({ event: 'chat updated', chatId: chatId });
    return this.channelsService.update(chatId, dto, authUser.user.id);
  }

  // @Post(':chatId/addUser/:userId')
  // async addUser(
  //   @Param('chatId') chatId: number,
  //   @Param('userId') userId: number,
  // ): Promise<ChatUserDto[]> {
  //   try {
  //     this.chatGateway.sendEvents({ message: 'user added', chatId: chatId, event: 'getChatUsers' });
  //     return await this.channelsService.addUserToChat(chatId, userId);
  //   } catch (error) {
  //     throw new NotFoundException(error.message, 'Not Found');
  //   }
  // }

  @Post(':chatId/addUser/:userName')
  async addUserByName(
    @AuthUser() authUser: AuthUserInterface,
    @Param('chatId') chatId: number,
    @Param('userName') userName: string,
  ): Promise<ChatUserDto[]> {
    try {
      this.chatGateway.sendEvents({
        message: 'user added',
        chatId: chatId,
        event: 'addUsersToChat',
      });
      return await this.channelsService.addUserToChatByName(
        chatId,
        userName,
        authUser.user.id,
      );
    } catch (error) {
      throw new NotFoundException(error.message, 'Not Found');
    }
  }

  @Post(':chatId/kick/:userId')
  @ApiOperation({
    summary: 'kick user from chat',
    description: 'gets Id of and id of user that need to be kicked)',
  })
  @ApiParam({
    name: 'chatId',
    type: Number,
    description: 'The ID of the chat',
    example: 42,
  })
  @ApiParam({
    name: 'userId',
    type: Number,
    description: 'The ID of the user',
    example: 23,
  })
  async removeUser(
    @AuthUser() authUser: AuthUserInterface,
    @Param('chatId') chatId: number,
    @Param('userId') userId: number,
  ): Promise<ChatUserDto[] | null> {
    this.chatGateway.sendEvents({
      message: 'user removed',
      chatId: chatId,
      event: 'getChatUsers',
    });
    return await this.channelsService.removeUserFromChat(
      chatId,
      userId,
      authUser.user.id,
    );
  }

  @Get(':chatId/users')
  @ApiOperation({
    summary: 'get all users in chat',
  })
  @ApiParam({
    name: 'chatId',
    type: Number,
    description: 'The ID of the chat',
    example: 42,
  })
  async getUsers(@Param('chatId') chatId: number): Promise<ChatUserDto[]> {
    try {
      return await this.channelsService.findAllUsers(chatId);
    } catch (error) {
      throw new NotFoundException(error.message, 'Not Found');
    }
  }

  @Post(':chatId/addAdmin/:userId')
  @ApiOperation({
    summary: 'add admin to chat',
    description: 'gets chat id and user that will become admin in this chat',
  })
  @ApiParam({
    name: 'chatId',
    type: Number,
    description: 'The ID of the chat',
    example: 22,
  })
  @ApiParam({
    name: 'userId',
    type: Number,
    description: 'The ID of the chat',
    example: 42,
  })
  async addAdmin(
    @Param('chatId') chatId: number,
    @Param('userId') userId: number,
    @AuthUser() authUser: AuthUserInterface,
    // @Body() dto: chatDelete,
  ): Promise<ChatUserDto[]> {
    try {
      this.chatGateway.sendEvents({
        message: 'admin added',
        chatId: chatId,
        event: 'getChatAdmins',
      });
      return await this.channelsService.addAdminToChat(
        chatId,
        userId,
        authUser.user.id,
      );
    } catch (error) {
      throw new NotFoundException(error.message, 'Not Found');
    }
  }

  @Post(':chatId/removeAdmin/:adminId')
  @ApiOperation({
    summary: 'remove admin from chat',
    description: 'gets chat id and admin that will be removed',
  })
  @ApiParam({
    name: 'chatId',
    type: Number,
    description: 'The ID of the chat',
    example: 12,
  })
  @ApiParam({
    name: 'adminId',
    type: Number,
    description: 'The ID of the chat',
    example: 11,
  })
  async removeAdmin(
    @Param('chatId') chatId: number,
    @Param('adminId') adminId: number,
    @AuthUser() authUser: AuthUserInterface,
    // @Body() dto: adminRemove,
  ): Promise<ChatUserDto[] | null> {
    try {
      this.chatGateway.sendEvents({
        message: 'admin removed',
        chatId: chatId,
        event: 'getChatAdmins',
      });
      return await this.channelsService.removeAdminFromChat(
        chatId,
        adminId,
        authUser.user.id,
      );
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(error.message);
      } else {
        throw error;
      }
    }
  }

  @Get(':chatId/admins')
  @ApiOperation({ summary: 'get all admins in chat' })
  @ApiParam({
    name: 'chatId',
    type: Number,
    description: 'The ID of the chat',
    example: 22,
  })
  async getAdmins(
    @Param('chatId') chatId: number,
  ): Promise<ChatUserDto[] | null> {
    try {
      return await this.channelsService.findAllAdmins(chatId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(error.message);
      }
      throw new Error('An error occurred while getting admins the user');
    }
  }

  @Get(':chatId/bannedUsers')
  @ApiOperation({ summary: 'get all admins in chat' })
  @ApiParam({
    name: 'chatId',
    type: Number,
    description: 'The ID of the chat',
    example: 22,
  })
  async getBanned(@Param('chatId') chatId: number): Promise<ReturnBannedDto[]> {
    return await this.bannedService.findAllBannedUsersInChat(chatId);
  }

  // add AuthUser and check if user is admin
  @Post(':chatId/banUser/:adminId')
  @ApiOperation({
    summary: 'ban user in chat',
    description: 'gets chat id and adminId as params + dto with ban info',
  })
  @ApiParam({
    name: 'chatId',
    type: Number,
    description: 'The ID of the chat',
    example: 42,
  })
  @ApiParam({
    name: 'adminId',
    type: Number,
    description: 'The ID of the admin',
    example: 22,
  })
  @ApiBody({
    description: 'Ban info',
    type: BanUserDto,
    examples: {
      NormalRequest: {
        summary: 'A normal example',
        value: {
          userId: 123,
          reasin: 'ban reason',
        },
      },
    },
  })
  async addBannedUserToChat(
    @Param('chatId') chatId: number,
    @Param('adminId') adminId: number,
    @Body() dto: BanUserDto,
    @AuthUser() authUser: AuthUserInterface,
  ): Promise<ReturnBannedDto[]> {
    this.chatGateway.sendEvents({
      message: 'user banned',
      chatId: chatId,
      event: 'getChatBanned',
    });
    return await this.bannedService.createBanned(
      chatId,
      dto.userId,
      authUser.user.id,
      dto.reason,
    );
  }

  @Post(':chatId/removeBanned/:bannedId')
  @ApiOperation({
    summary: 'remove banned user from chat',
  })
  @ApiParam({
    name: 'chatId',
    type: Number,
    description: 'The ID of the chat',
    example: 42,
  })
  @ApiParam({
    name: 'bannedId',
    type: Number,
    description: 'The ID of the banned user',
    example: 24,
  })
  async removeBanned(
    @Param('bannedId') bannedId: number,
    @Param('chatId') chatId: number,
    @AuthUser() authUser: AuthUserInterface,
    // @Body() dto: chatDelete,
  ): Promise<ReturnBannedDto[]> {
    this.chatGateway.sendEvents({
      message: 'user unbanned',
      chatId: chatId,
      event: 'removeBanned',
    });
    return await this.bannedService.removeBannedById(
      bannedId,
      chatId,
      authUser.user.id,
    );
  }

  @Post(':chatId/unBan')
  @ApiOperation({
    summary: 'unban user from chat',
  })
  @ApiParam({
    name: 'chatId',
    type: Number,
    description: 'The ID of the chat',
    example: 42,
  })
  @ApiBody({
    description: 'id of user to unban',
    type: BanUserDto,
    examples: {
      NormalRequest: {
        summary: 'A normal example',
        value: {
          userId: 123,
        },
      },
    },
  })
  async unbanUser(
    @Param('chatId') chatId: number,
    @Body() dto: { userId: number },
    @AuthUser() authUser: AuthUserInterface,
  ): Promise<ReturnBannedDto[]> {
    this.chatGateway.sendEvents({
      message: 'user unbanned',
      chatId: chatId,
      event: 'unbanUser',
    });
    return await this.bannedService.unbanUser(
      chatId,
      dto.userId,
      authUser.user.id,
    );
  }

  @Post(':messageId/updateMessage')
  @ApiOperation({
    summary: 'update message',
  })
  @ApiBody({
    description: 'update message',
    type: UpdateMessageDto,
    examples: {
      NormalRequest: {
        summary: 'Updated message dto example',
        value: {
          messageId: 123,
          message: 'updated message',
        },
      },
    },
  })
  async updateMessage(
    @Body() dto: UpdateMessageDto,
    @AuthUser() authUser: AuthUserInterface,
  ): Promise<ReturnMessageDto> {
    this.chatGateway.sendEvents({
      message: 'mesagre updated',
      event: 'getChatMessages',
    });
    return await this.messageService.updateMessage(
      dto.messageId,
      dto.message,
      authUser.user.id,
    );
  }

  @Post(':chatId/createmessage')
  @ApiOperation({
    summary: 'create message',
  })
  @ApiParam({
    name: 'chatId',
    type: Number,
    description: 'The ID of the chat',
    example: 42,
  })
  @ApiBody({
    description: 'create message',
    type: CreateMessageDto,
    examples: {
      NormalRequest: {
        summary: 'Create message dto example',
        value: {
          message: 'new message',
          userId: 123,
        },
      },
    },
  })
  async createMessage(
    @AuthUser() authUser: AuthUserInterface,
    @Param('chatId') chatId: number,
    @Body() dto: CreateMessageDto,
  ): Promise<ReturnMessageDto> {
    // return await this.channelsService.createMessage
    this.chatGateway.sendEvents({
      message: 'mesagre created',
      chatId: chatId,
      event: 'getChatMessages',
    });
    return await this.messageService.createMessage(
      chatId,
      dto.message,
      authUser.user.id,
    );
  }

  @Post(':chatId/deleteMessage/:messageId')
  @ApiOperation({
    summary: 'delete message',
  })
  @ApiParam({
    name: 'chatId',
    type: Number,
    description: 'The ID of the chat',
    example: 42,
  })
  @ApiParam({
    name: 'messageId',
    type: Number,
    description: 'The ID of the message',
    example: 24,
  })
  async deleteMessage(
    @Param('messageId') messageId: number,
    @Param('chatId') chatId: number,
    @AuthUser() authUser: AuthUserInterface,
    // @Body() dto: messageRem,
  ): Promise<ReturnMessageDto[]> {
    this.chatGateway.sendEvents({
      message: 'mesagre deleted',
      chatId: chatId,
      event: 'getChatMessages',
    });
    return await this.messageService.deleteMessage(
      messageId,
      chatId,
      authUser.user.id,
    );
  }

  @Get(':chatId/messages')
  @ApiOperation({
    summary: 'get chat messages',
  })
  @ApiParam({
    name: 'chatId',
    type: Number,
    description: 'The ID of the chat',
    example: 42,
  })
  async chatMessages(
    @Param('chatId') chatId: number,
    @AuthUser() authUser: AuthUserInterface,
  ): Promise<ReturnMessageDto[]> {
    return await this.messageService.findAllMessagesByChannel(
      chatId,
      authUser.user.id,
    );
  }

  @Get(':chatId/muted')
  @ApiOperation({
    summary: 'get muted users in chat',
  })
  @ApiParam({
    name: 'chatId',
    type: Number,
    description: 'The ID of the chat',
    example: 42,
  })
  async findAllMutedAtChat(
    @Param('chatId') chatId: number,
    @AuthUser() authUser: AuthUserInterface,
  ): Promise<ReturnMutedDto[]> {
    return await this.channelsService.getMute(chatId, authUser.user.id);
  }

  @Post(':chatId/muteUser')
  @ApiOperation({
    summary: 'mute user in chat',
  })
  @ApiParam({
    name: 'chatId',
    type: Number,
    description: 'The ID of the chat',
    example: 42,
  })
  @ApiBody({
    description: 'mute user in chat',
    type: CreateMuteDto,
    examples: {
      NormalRequest: {
        summary: 'Mute user dto example',
        value: {
          userId: 123,
          mutedById: 123,
          mutedUntil: new Date(),
        },
      },
    },
  })
  async muteuUser(
    @Param('chatId') chatId: number,
    @AuthUser() authUser: AuthUserInterface,
    @Body() dto: CreateMuteDto,
  ): Promise<ReturnMutedDto[]> {
    this.chatGateway.sendEvents({
      message: 'user muted',
      event: 'getChatMuted',
    });
    dto.mutedById = authUser.user.id;
    return await this.channelsService.muteUser(
      dto.userId,
      chatId,
      dto.mutedById,
      dto.mutedUntil,
    );
  }

  @Post(':chatId/muteUpdate')
  @ApiOperation({
    summary: 'update mute user in chat',
  })
  @ApiParam({
    name: 'chatId',
    type: Number,
    description: 'The ID of the chat',
    example: 42,
  })
  @ApiBody({
    description: 'update mute user in chat',
    type: UpdateMuteDto,
    examples: {
      NormalRequest: {
        summary: 'Update mute user dto example',
        value: {
          muteId: 123,
          mutedUntil: new Date(),
        },
      },
    },
  })
  async updateMute(
    @Param('chatId') chatId: number,
    @Body() dto: UpdateMuteDto,
    @AuthUser() authUser: AuthUserInterface,
  ): Promise<ReturnMutedDto[]> {
    this.chatGateway.sendEvents({
      message: 'user muted',
      event: 'getChatMuted',
    });
    return await this.channelsService.muteUpdated(
      dto.muteId,
      chatId,
      authUser.user.id,
      dto.mutedUntil,
    );
  }

  @Post(':chatId/unmute/')
  @ApiOperation({
    summary: 'unmute user in chat',
  })
  @ApiParam({
    name: 'chatId',
    type: Number,
    description: 'The ID of the chat',
    example: 42,
  })
  @ApiBody({
    description: 'unmute user in chat',
    type: muteD,
    examples: {
      NormalRequest: {
        summary: 'Unmute user dto example',
        value: {
          userId: 123,
        },
      },
    },
  })
  async unMute(
    // @Param('mutedId') mutedId: number,
    @AuthUser() authUser: AuthUserInterface,
    @Param('chatId') chatId: number,
    @Body() dto: muteD,
  ): Promise<ReturnMutedDto[]> {
    this.chatGateway.sendEvents({
      message: 'mute update',
      event: 'getChatMuted',
    });
    return await this.channelsService.unMute(
      dto.userId,
      chatId,
      authUser.user.id,
    );
  }

  @Post(':chatId/joinChat/:userId')
  @ApiOperation({
    summary: 'add user to active chatUsers list',
  })
  @ApiParam({
    name: 'chatId',
    type: Number,
    description: 'The ID of the chat',
    example: 42,
  })
  @ApiParam({
    name: 'userId',
    type: Number,
    description: 'The ID of the user',
    example: 24,
  })
  async join(
    @Param('chatId') chatId: number,
    @Param('userId') userId: number,
    @AuthUser() authUser: AuthUserInterface,
  ): Promise<ChatUserDto[]> {
    this.chatGateway.sendEvents({
      message: 'user joinchat',
      event: 'getActiveUsers',
    });
    return await this.channelsService.joinChannel(chatId, authUser.user.id);
  }

  @Post(':chatId/quitChat/:userId')
  @ApiOperation({
    summary: 'remove user from active chatUsers list',
  })
  @ApiParam({
    name: 'chatId',
    type: Number,
    description: 'The ID of the chat',
    example: 42,
  })
  @ApiParam({
    name: 'userId',
    type: Number,
    description: 'The ID of the user',
    example: 24,
  })
  async quit(
    @Param('chatId') chatId: number,
    @Param('userId') userId: number,
    @AuthUser() authUser: AuthUserInterface,
    // @Body() dto: chatD,
  ): Promise<ChatUserDto[]> {
    this.chatGateway.sendEvents({
      message: 'user quitChat',
      event: 'quitChat',
      chatId: chatId,
    });
    return await this.channelsService.quitChannel(chatId, authUser.user.id);
  }

  @Get(':chatId/activeUsers')
  @ApiOperation({
    summary: 'get all active users in chat',
  })
  @ApiParam({
    name: 'chatId',
    type: Number,
    description: 'The ID of the chat',
    example: 42,
  })
  async active(@Param('chatId') chatId: number): Promise<ChatUserDto[]> {
    return await this.channelsService.getActiveUsers(chatId);
  }

  //   @Get('channels/:chatId/pwd')
  //   async getPwd(@Param('chatId') chatId: number): Promise<string> {
  //     return await this.channelsService.getPassword(chatId);
  //   }
  // }
}
