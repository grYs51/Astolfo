import { mockClient } from '../../../__mocks__/client';
import VoiceDurationUpdateEvent from './voiceDurationUpdateEvent';

describe('VoiceDurationUpdateEvent', () => {
  let client: typeof mockClient;
  let oldState;
  let newState;
  let voiceDurationUpdateEvent: VoiceDurationUpdateEvent;

  beforeEach(() => {
    client = mockClient;
    oldState = {
      channel: null,
    };
    newState = {
      channel: null,
    }
    voiceDurationUpdateEvent = new VoiceDurationUpdateEvent();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should add voice user to voiceUsers array when user joins an voiceChannel', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1577836800000);
    oldState.channel = null;
    newState = {
      channel: {
        id: '123',
      },
      guild: {
        id: '123',
      },
      member: {
        id: '123',
      },
    };
    await voiceDurationUpdateEvent.run(
      client as any,
      oldState as any,
      newState as any,
    );
    expect(client.voiceUsers.push).toHaveBeenCalledWith({
      channel_id: '123',
      guild_id: '123',
      issued_on: expect.any(Date),
      member_id: '123',
      type: 'VOICE',
    });
  });

  test('should call handleVoiceUserLog when user leaves a voiceChannel', async () => {
    oldState = {
      channel: {
        id: '123',
      },
      guild: {
        id: '123',
      },
      member: {
        id: '123',
      },
    };
    newState.channel = null;
    client.voiceUsers.find = jest.fn().mockReturnValue({
      channel_id: '123',
      guild_id: '123',
      issued_on: new Date('2020-01-01'),
      member_id: '123',
      type: 'VOICE',
    });

    client.voiceUsers.filter = jest.fn().mockReturnValue([]);

    await voiceDurationUpdateEvent.run(
      client as any,
      oldState as any,
      newState as any,
    );
    expect(client.voiceUsers.filter).toHaveBeenCalled();
    expect(client.dataSource.voiceStats.create).toHaveBeenCalledWith({
      data: {
        channel_id: '123',
        ended_on: expect.any(Date),
        guild_id: '123',
        issued_on: new Date('2020-01-01'),
        member_id: '123',
        type: 'VOICE',
      },
    });
  });

  test('should call handleVoiceUserLog when user changes voiceChannel', async () => {
    oldState = {
      channel: {
        id: '123',
      },
      guild: {
        id: '123',
      },
      member: {
        id: '123',
      },
    };
    newState = {
      channel: {
        id: '456',
      },
      guild: {
        id: '123',
      },
      member: {
        id: '123',
      },
    };
    await voiceDurationUpdateEvent.run(
      client as any,
      oldState as any,
      newState as any,
    );

    expect(client.voiceUsers.filter).toHaveBeenCalled();
    expect(client.dataSource.voiceStats.create).toHaveBeenCalledWith({
      data: {
        channel_id: '123',
        ended_on: expect.any(Date),
        guild_id: '123',
        issued_on: new Date('2020-01-01'),
        member_id: '123',
        type: 'VOICE',
      },
    });

    expect(client.voiceUsers.push).toHaveBeenCalledWith({
      channel_id: '456',
      guild_id: '123',
      issued_on: expect.any(Date),
      member_id: '123',
      type: 'VOICE',
    });
  });

  test('should not call handleVoiceUserLog when user changes voiceChannel to the same channel', async () => {
    oldState = {
      channel: {
        id: '123',
      },
      guild: {
        id: '123',
      },
      member: {
        id: '123',
      },
    };
    newState = {
      channel: {
        id: '123',
      },
      guild: {
        id: '123',
      },
      member: {
        id: '123',
      },
    };
    client.voiceUsers.find = jest.fn().mockReturnValue({
      channel_id: '123',
      guild_id: '123',
      issued_on: new Date('2020-01-01'),
      member_id: '123',
      type: 'VOICE',
    });
    await voiceDurationUpdateEvent.run(
      client as any,
      oldState as any,
      newState as any,
    );

    expect(client.voiceUsers.filter).not.toHaveBeenCalled();
    expect(client.dataSource.voiceStats.create).not.toHaveBeenCalled();
    expect(client.voiceUsers.push).not.toHaveBeenCalled();
  });
});
