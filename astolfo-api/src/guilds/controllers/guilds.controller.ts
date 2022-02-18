import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ROUTES, SERVICES } from 'src/utils/constants';
import WebSockectHandler from 'src/websocket/socket';
import { IGuildService } from '../interfaces/guilds';

@ApiTags(ROUTES.GUILDS)
@Controller(ROUTES.GUILDS)
export default class GuildsController {
  constructor(
    @Inject(SERVICES.GUILDS) private readonly guildsService: IGuildService,
    @Inject(WebSockectHandler) private readonly wsHandler: WebSockectHandler,
  ) {}

  @Get(':guildId/config')
  getGuildConfig(@Param('guildId') guildId: string) {
    return this.guildsService.getGuildConfig(guildId);
  }

  @Get(':guildId/info')
  getGuildInfo(@Param('guildId') guildId: string) {
    return this.guildsService.getGuildInfo(guildId);
  }

  @Post(':guildId/config/prefix')
  async updateGuildPrefix(
    @Param('guildId') guildId: string,
    @Body('prefix') prefix: string,
  ) {
    const config = await this.guildsService.updateGuildPrefix(guildId, prefix);
    this.wsHandler.guildConfigUpdate(config);
    return config;
  }

  @Post(':guildId/config/channel')
  async updateWelcomeChannel(
    @Param('guildId') guildId: string,
    @Body('channelId') channelId: string,
  ) {
    const config = await this.guildsService.updateWelcomeChannel(
      guildId,
      channelId,
    );
    this.wsHandler.guildConfigUpdate(config);
    return config;
  }

  @Post(':guildId/config/message')
  async updateWelcomeMessage(
    @Param('guildId') guildId: string,
    @Body('welcomeMessage') welcomeMessage: string,
  ) {
    const config = await this.guildsService.updateWelcomeMessage(
      guildId,
      welcomeMessage,
    );
    this.wsHandler.guildConfigUpdate(config);
    return config;
  }

  @Get(':guildId/logs')
  async getGuildLogs(
    @Param('guildId') guildId: string,
    @Query('fromDate') fromDate: Date,
  ) {
    return this.guildsService.getGuildLogs(guildId, fromDate);
  }

  @Get(':guildId/stats')
  async getGuildStats(
    @Param('guildId') guildId: string,
    @Query('fromDate') fromDate: Date,
  ) {
    return this.guildsService.getGuildStats(guildId, fromDate);
  }

  @Get(':guildId/members')
  getMembers(@Param('guildId') guildId: string) {
    return this.guildsService.getMembers(guildId);
  }

  @Get(':guildId/channels')
  getChannels(@Param('guildId') guildId: string) {
    return this.guildsService.getChannels(guildId);
  }

  @Get(':guildId/roles')
  getRoless(@Param('guildId') guildId: string) {
    return this.guildsService.getRoles(guildId);
  }
}
