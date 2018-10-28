const Discord = require('discord.js');
const ytdl = require('ytdl-core');
const dotenv = require('dotenv');
const level = require('level');
const util = require('util');
const fs = require('fs');

const client = new Discord.Client();
dotenv.load();

const commandPrefix = process.env.COMMAND_PREFIX;
const ignoreChannels = process.env.IGNORE_CHANNELS.split(',');

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
  console.log(msg);
  if (!msg.guild || msg.channel.type !== 'dm' ) return;

  if (isBotMention(client, msg)) {
    replyWithUsage(msg);
    return;
  }

  if(noCommandPrefix(msg, commandPrefix)) return;

  const args = msg.content.slice(commandPrefix.length).trim().split(/ +/g);
  const command = args.shift().toLowerCase();

  if (command === 'help') {
    replyWithUsage(msg);
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

    if (seek == NaN || seek < 0 || seek > 300) {
      msg.reply('Invalid offset time.');
      return;
    }

    if (duration == NaN || duration <= 0 || duration > 30) {
      msg.reply('Invalid duration time.');
      return;
    }

    ytdl.getInfo(url)
        .then((info) => {
            if (info.length_seconds > 600) {
                throw new Error("Source too long (max 10 minutes).");
            }

            return info;
        }).then((info) => {
           msg.reply(`**Setting into music - downloading source - please wait...**`);

           let stream = ytdl(url, { filter: (format) => format.container === 'm4a' })
                        .pipe(fs.createWriteStream(authorName + '.m4a'));
        
           stream.on('finish', () => {
                setUserIntro(authorName, {url: url, seek: seek, duration: duration})
                .then( () => {
                    msg.reply(`**Intro music set!** Source: ${info.title} | Offset: ${seek}s | Duration: ${duration}s`);
                });
           });
        }).catch(err => {
            msg.reply(`!! ERROR !!: ${err}`)
        });

    return;
  }  
});

client.on('voiceStateUpdate', (oldMember, newMember) => {
  const userName = userUniqueName(newMember.user);
  const channel = newMember.voiceChannel;
  if (userName === userUniqueName(client.user))  return;
  if (!channel) return;
  if (ignoreChannels.includes(channel.name)) return;

  console.info(`${userName} joined ${channel.name}`);

  channel.join()
    .then(connection => {
        if (connection.speaking)
            return;

        getUserIntro(userName)
            .then((userIntro) => {
                if (userIntro && fs.existsSync(userName + '.m4a')) {
                    console.info(`${userName} intro found. Playing intro.`);
                    const dispatcher = connection.playFile(userName + '.m4a', { volume: 0.75, seek: userIntro.seek });

                    setTimeout(() => {
                        dispatcher.end();
                    }, userIntro.duration * 1000);
                    
                    dispatcher.on('end', () => {
                        console.info(`${userName} playback complete. Disconnecting.`);
                        connection.disconnect();
                    });
                } else {
                    console.info(`${userName} no intro file found.`);
                }
            })
    })
    .catch(console.error);
  
});

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
      return false;
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

replyWithUsage = (msg) => {
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


