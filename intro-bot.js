const Discord = require('discord.js');
const ytdl = require('ytdl-core');
const dotenv = require('dotenv');
const level = require('level');
const util = require('util');

const client = new Discord.Client();
dotenv.load();

const commandPrefix = process.env.COMMAND_PREFIX;
let activeStreams = [];

const db = level(process.env.DB_LOCATION, {}, (error, db) => {
  if(error) {
    console.error(error);
    process.exit(1);
  }
});


client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on('message', msg => {
  if (!msg.guild) return;

  if (isBotMention(client, msg)) {
    replyWithUsage();
    return;
  }

  if(noCommandPrefix(msg, commandPrefix)) return;

  const args = msg.content.slice(commandPrefix.length).trim().split(/ +/g);
  const command = args.shift().toLowerCase();

  if (command === 'help') {
    replyWithUsage();
    return;
  }

  if(command === 'set') {
    let url = args[0];
    let seek = parseInt(args[1]);
    let duration = parseInt(args[2]);
    let authorName = userUniqueName(msg.author);

    if (! (url.startsWith('http:') || url.startsWith('https:')) ) {
      msg.reply('Invalid URL. URLs must start with http or https');
      return;
    }

    if (! (url.startsWith('https://youtu.be/') || url.startsWith('https://www.youtube.com/')) ) {
      msg.reply('Only YouTube URLs are support at this time.');
      return;
    }

    if (seek == NaN) {
      msg.reply('Invalid offset time. Not a number.');
      return;
    }

    if (seek > 300) {
      msg.reply('Invalid offset time. Exceeds maximum value.');
      return;
    }

    if (duration == NaN) {
      msg.reply('Invalid duration time. Not a number.');
      return;
    }

    if (duration > 30) {
      msg.reply('Invalid duration time. Exceeds maximum value.');
      return;
    }
    
    setUserIntro(authorName, {url: url, seek: seek, duration: duration})
      .then(() => {
        msg.reply(`**Intro music set!** Source: ${url} | Offset: ${seek}s | Duration: ${duration}s`);
      })
      .catch(err => console.error(err));

    return;
  }  
});

client.on('voiceStateUpdate', (oldMember, newMember) => {
  const userName = userUniqueName(newMember.user);
  if (userName === userUniqueName(client.user))  return;
  if (!newMember.voiceChannel) return;

  newMember.voiceChannel.join()
    .then(connection => { 
      getUserIntro(userName)
        .then((userIntro) => {
          const stream = ytdl(userIntro.url, { filter: 'audioonly' });
          const dispatcher = connection.playStream(stream, { volume: 0.75, seek: userIntro.seek });

          activeStreams.push({user: userName, dispatcher: dispatcher, duration: userIntro.duration, status: 'playing'});
        })
        .catch(err => {
          console.error(err);
        });
      
    })
    .catch(console.log);
  
});

client.setInterval(() => {
  activeStreams.forEach(stream => {
    if (stream.status === 'playing' && stream.duration * 1000 <= stream.dispatcher.time) {
      stream.dispatcher.end();
      stream.status = 'ended';
    }
  });

  activeStreams = activeStreams.filter(stream => {
    stream.status === 'playing';
  });
}, process.env.DISPATCHER_CHECK_INTERVAL * 1000);

client.login(process.env.DISCORD_BOT_KEY);

userUniqueName = user => {
  return user.username + '#' + user.discriminator;
}

getUserIntro = async (userName) => {
  try {
    const url = await db.get(`${userName}.url`);
    const seek = await db.get(`${userName}.seek`);
    const duration = await db.get(`${userName}.duration`);

    return {url, seek, duration};
  } catch (err) {
    if (err.notFound)
      return {url: process.env.DEFAULT_STREAM_URL, seek: process.env.DEFAULT_SEEK, duration: process.env.DEFAULT_DURATION};
    throw err;
  }
}

setUserIntro = async (userName, userIntro) => {
  try {
    await db.put(`${userName}.url`, userIntro.url);
    await db.put(`${userName}.seek`, userIntro.seek);
    await db.put(`${userName}.duration`, userIntro.duration);

    return true;
  } catch (err) {
    throw err;
  }
}

isBotMention = (client, msg) => {
  return msg.mentions.users.find(user => userUniqueName(user) === userUniqueName(client.user))
}

replyWithUsage = () => {
  msg.reply(usage);
}

noCommandPrefix = (msg, prefix) => {
  return !msg.content.startsWith(prefix);
}

const usage = [
  "**__Intro Bot Help__**",
  `*Command Prefix:* ${commandPrefix}`, "",
  `**${commandPrefix} help**`,
  "*Displays this help text.*", "",
  `**${commandPrefix} set [url] [offset] [duration]**`, 
  "*Sets introduction stream URL, time offset in seconds, and playback duration in seconds (max. 30)*"
];