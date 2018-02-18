const Discord = require('discord.js');
const fs = require('fs');
const client = new Discord.Client();
const ytdl = require('ytdl-core');
let voiceConnection;
let dispatcher;

fs.readFileSync('./test.mp3');
client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on('message', msg => {
  if (!msg.guild) return;
	

  if (msg.content === '/join') {
    // Only try to join the sender's voice channel if they are in one themselves
    if (msg.member.voiceChannel) {
      msg.member.voiceChannel.join()
        .then(connection => { // Connection is an instance of VoiceConnection
          msg.reply('I have successfully connected to the channel!');
        })
        .catch(console.log);
    } else {
      msg.reply('You need to join a voice channel first!');
    }
  }

    if(msg.content === '/play') {
        msg.reply('Playing Test MP3...');
        //const stream = ytdl('https://youtu.be/9jK-NcRmVcw', { filter: 'audioonly' });
        client.voiceConnections.first().playFile('./test.mp3', {volume: 0.5});
        client.voiceConnections.first().dispatcher.on('error', console.log);
        client.voiceConnections.first().on('error', console.log);
        client.voiceConnections.first().on('failed', console.log);
        client.voiceConnections.first().on('warn', console.log);
        client.voiceConnections.first().player.on('warn', console.log);
        client.voiceConnections.first().on('debug', console.log);
    }

    if(msg.content === '/stop') {
        msg.reply('Stopping playback.');
        client.voiceConnections.first().dispatcher.end();
    }
});

client.login('NDE0ODMyNzE5MTcyODYxOTYz.DWtGnA.jr-3I8dZ4QSfu40rloSBhc3H6Tk');
