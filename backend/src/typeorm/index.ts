import { BannedEntity } from './banned.entity';
import { ChannelsEntity } from './channel.entity';
import { Friendship } from './friendship.entity';
import { MessagesEntity } from './messages.entity';
import { MutedEntity } from './muted.entity';
import { UserSession } from './user-session.entity';
import { User } from './user.entity';
import { User2fa } from './user_2fa.entity';
import { Match } from './match.entity';
import { Stats } from './stats.entity';
import { BlockUser } from '@backend/features/block/dto/BlockUser.dto';

const entities = [
  User,
  Friendship,
  User2fa,
  ChannelsEntity,
  BannedEntity,
  MessagesEntity,
  MutedEntity,
  UserSession,
  Match,
  Stats,
  BlockUser,
];

export {
  User,
  Friendship,
  User2fa,
  ChannelsEntity,
  BannedEntity,
  MessagesEntity,
  MutedEntity,
  UserSession,
  Match,
  Stats,
  BlockUser,
};
export default entities;
