import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BannedService } from './banned.service';
import { BannedEntity, ChannelsEntity, User } from '@backend/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([BannedEntity, ChannelsEntity, User])],
  providers: [BannedService],
  exports: [BannedService],
})
export class BannedModule {}
