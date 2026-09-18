import { Module } from '@nestjs/common';
import { ChannelsController } from './channels.controller';
import { ChannelsService } from './channels.service';
import { PingSchedulerService } from './ping-scheduler.service';
import { SampleRetentionService } from './sample-retention.service';

@Module({
  controllers: [ChannelsController],
  providers: [ChannelsService, PingSchedulerService, SampleRetentionService],
})
export class MonitoringModule {}
