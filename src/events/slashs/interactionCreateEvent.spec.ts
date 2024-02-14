import { Interaction } from "discord.js";
import { mockClient } from "../../../__mocks__/client";
import InteractionCreateEvent from "./interactionCreateEvent";
import { mockInteraction } from "../../../__mocks__/interaction";

describe('InteractionCreateEvent', () => {
  let client: typeof mockClient;
  let interaction: Interaction;
  let interactionCreateEvent: InteractionCreateEvent;

  beforeEach(() => {
    client = mockClient;
    interaction = mockInteraction as unknown as Interaction;
    interactionCreateEvent = new InteractionCreateEvent();
  });

  test('should not run command if interaction is not a command', async () => {
    interaction.isCommand = jest.fn().mockReturnValue(false);
    await interactionCreateEvent.run(client as any, interaction as any);
    expect(client.slashs.get).not.toHaveBeenCalled();
  });

  test('should not run command if no slash', async () => {
    interaction.isCommand = jest.fn().mockReturnValue(true);
    client.slashs.get = jest.fn().mockReturnValue(null);
    await interactionCreateEvent.run(client as any, interaction as any);
    expect(client.slashs.get).toHaveBeenCalledWith("test-command-name");
  });

  test('should run command if interaction is a command', async () => {
    interaction.isCommand = jest.fn().mockReturnValue(true);
    client.slashs.get = jest.fn().mockReturnValue({ run: jest.fn() });
    await interactionCreateEvent.run(client as any, interaction as any);
    expect(client.slashs.get).toHaveBeenCalledWith("test-command-name");
    expect(client.slashs.get("test-commad-name").run).toHaveBeenCalledWith(client, interaction);
  });
});