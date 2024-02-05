import "dotenv/config";
import express from "express";
import {
  InteractionType,
  InteractionResponseType,
  InteractionResponseFlags,
  MessageComponentTypes,
  ButtonStyleTypes,
} from "discord-interactions";
import { VerifyDiscordRequest, DiscordRequest } from "./utils.js";
import {
  Client,
  Events,
  GatewayIntentBits,
  SlashCommandBuilder,
  GuildScheduledEventManager,
  GuildScheduledEventPrivacyLevel,
  GuildScheduledEventEntityType,
  CDN, GuildScheduledEvent,
} from "discord.js";


const app = express();
const PORT = process.env.PORT || 3000;

const EVENT_START_HOURLY = 3600000;
const EVENT_START_DAILY = 86400000;
const EVENT_START_WEEKLY = 604800000;
const EVENT_START_MONTHLY = 2628000000;
const EVENT_DURATION = 6000000; //100 minutes in ms
const EVENT_DURATION_HOURLY = 3559000;

// Parse request body and verifies incoming requests using discord-interactions package
app.use(express.json({ verify: VerifyDiscordRequest(process.env.PUBLIC_KEY) }));

const token = process.env.BOT_TOKEN;
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    //   GatewayIntentBits.GuildMessageReactions,
    //   GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    //  GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildScheduledEvents,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildBans
  ],
});

client.login(token).then(r => console.log("login success")).catch(e => {
  console.log("login failed");
  console.error(e);
});

client.on("guildScheduledEventCreate", async (m) => {
  console.log("scheduled event created");
  console.log(m);
});

client.on("guildScheduledEventUpdate", async (before, after) => {
  console.log("scheduled event updated");
  console.log(before.name);
  console.log(after);

  //check for indluded words to trigger different events
  /* Scheduled = 1, Active = 2,Completed = 3, Canceled = 4 */

  //trigger on starting an event, if the description includes "daily"
  if ( before.status === 1 && after.status === 2) {
    if(before.description.includes(":hourly:")) {
      setupEvent(before, after, EVENT_START_HOURLY, EVENT_DURATION_HOURLY)
    } else if (before.description.includes(":daily:")) {
      setupEvent(before, after, EVENT_START_DAILY, EVENT_DURATION)
    } else if (before.description.includes(":weekly:")) {
      setupEvent(before, after, EVENT_START_WEEKLY, EVENT_DURATION)
    } else if (before.description.includes(":monthly:")) {
      setupEvent(before, after, EVENT_START_MONTHLY, EVENT_DURATION)
    }
  }
});

client.on("guildScheduledEventDelete", async (m) => {
  console.log("scheduled event deleted");
  console.log(m);
});

app.post("/interactions", async function (req, res) {
  // Interaction type and data
  const { type, id, data } = req.body;

  /**
   * Handle verification requests
   */
  if (type === InteractionType.PING) {
    return res.send({ type: InteractionResponseType.PONG });
  }

  /**
   * Handle slash command requests
   * See https://discord.com/developers/docs/interactions/application-commands#slash-commands
   
  if (type === InteractionType.APPLICATION_COMMAND) {
    const { name } = data;

    // "help" command
    if (name === "help") {
      // Send a message into the channel where command was triggered from
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          // Fetches a random emoji to send from a helper function
          content:
            "Hi! I'm the event repeater bot. Simply add "Repeat" to your events description, and I'll create a followup-event a week later as soon as the event is started.",
        },
      });
    }
      
  }
  */
});

app.listen(PORT, () => {
  console.log("Listening on port", PORT);
});


async function setupEvent(before, after, startingTimeBasedOnLastEvent, duration) {
  const guild = await client.guilds.fetch(before.guildId);
  const channel = await client.channels.fetch(before.channelId);
  const cdn = new CDN();
  const imageLink = cdn.guildScheduledEventCover(before.id, before.image, {size: 4096,});

  //Create new event using the information from the old event
  const event_manager = new GuildScheduledEventManager(guild);
  await event_manager.create({
    name: before.name,
    description: before.description,
    scheduledStartTime: before.scheduledStartTimestamp + startingTimeBasedOnLastEvent,
    scheduledEndTime: before.scheduledStartTimestamp + duration,
    channel: channel,
    privacyLevel: 2,
    entityType: 3,
    image: imageLink
  });
}