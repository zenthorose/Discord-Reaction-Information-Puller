require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Collection, EmbedBuilder, REST, Routes } = require('discord.js');

const client = new Client({
    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildMessageTyping,
        GatewayIntentBits.DirectMessageReactions
    ]
});

const prefix = '.';
const fs = require('fs');
client.commands = new Collection();
const botToken = process.env.BOT_TOKEN;

const { MaleEmoji, MaleRole, FemaleEmoji, FemaleRole, MaleName, FemaleName } = require('./config.json');
const reactionPosts = require('./reactionPosts');


const commandFiles = fs.readdirSync('./commands/').filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    if (command.data && command.data.name) {
        client.commands.set(command.data.name, command);
    } else {
        console.error(`Command file ${file} is missing a valid command structure.`);
    }
}

client.once('ready', async () => {
    console.log(`Bot is online!`);

    const commands = client.commands.map(command => command.data.toJSON());
    const rest = new REST({ version: '10' }).setToken(botToken);
    try {
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );
        console.log('Successfully registered application commands.');
    } catch (error) {
        console.error(error);
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction, client);
    } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
    }
});

client.on('messageReactionAdd', async (reaction, user) => {
    if (reaction.message.partial) await reaction.message.fetch();
    if (reaction.partial) await reaction.fetch();
    if (user.bot) return;
    if (!reaction.message.guild) return;
    // if (reaction.message.channel.id == channel) {
    const post = reactionPosts.find(post => post.messageId === reaction.message.id);
    if (post) {
        if (reaction.emoji.name === MaleEmoji) {
            await reaction.message.guild.members.cache.get(user.id).roles.add(MaleRole);
            post.reactions.push(MaleEmoji);
        }
        if (reaction.emoji.name === FemaleEmoji) {
            await reaction.message.guild.members.cache.get(user.id).roles.add(FemaleRole);
            post.reactions.push(FemaleEmoji);
        }
    }
    // }
});

client.on('messageReactionRemove', async (reaction, user) => {
    if (reaction.message.partial) await reaction.message.fetch();
    if (reaction.partial) await reaction.fetch();
    if (user.bot) return;
    if (!reaction.message.guild) return;

    const post = reactionPosts.find(post => post.messageId === reaction.message.id);
    if (post) {
        if (reaction.emoji.name === MaleEmoji) {
            await reaction.message.guild.members.cache.get(user.id).roles.remove(MaleRole);
            const index = post.reactions.indexOf(MaleEmoji);
            if (index > -1) post.reactions.splice(index, 1);
        }
        if (reaction.emoji.name === FemaleEmoji) {
            await reaction.message.guild.members.cache.get(user.id).roles.remove(FemaleRole);
            const index = post.reactions.indexOf(FemaleEmoji);
            if (index > -1) post.reactions.splice(index, 1);
        }
    }

});

const calculateTotalReactions = (post) => {
    let totalMaleReactions = 0;
    let totalFemaleReactions = 0;
    post.reactions.forEach(reaction => {
        if (reaction === MaleEmoji) {
            totalMaleReactions++;
        }
        if (reaction === FemaleEmoji) {
            totalFemaleReactions++;
        }
    });
    return { totalMaleReactions, totalFemaleReactions };
};

client.on('messageCreate', message => {
    if (message.content.startsWith('!total')) {
        const splitMessage = message.content.split(' ');
        if (splitMessage.length > 1) {
            const postId = splitMessage[1];
            const post = reactionPosts.find(post => post.messageId === postId);
            if (post) {
                const { totalMaleReactions, totalFemaleReactions } = calculateTotalReactions(post);
                message.channel.send(`Post in channel ${post.channelId} with message ID ${post.messageId} has ${totalMaleReactions} male reactions and ${totalFemaleReactions} female reactions.`);
            } else {
                message.channel.send(`No post found with message ID ${postId}.`);
            }
        } else {
            message.channel.send(`Total reactions for each post:`);
            reactionPosts.forEach(post => {
                const { totalMaleReactions, totalFemaleReactions } = calculateTotalReactions(post);
                message.channel.send(`Post in channel ${post.channelId} with message ID ${post.messageId} has ${totalMaleReactions} male reactions and ${totalFemaleReactions} female reactions.`);
            });
        }
    }


    if (message.content === '!ping') {
        message.channel.send('Pong!');
    }

    if (message.content === '!reactionrole') {
        const exampleEmbed = new EmbedBuilder()
            .setColor('#17b111')
            .setTitle('React to the corresponding emojis to get personalized notifications!')
            .setDescription(`Once reacting you will gain your roles!\n\n${MaleEmoji} for ${MaleName}\n${FemaleEmoji} for ${FemaleName}\n`)
            .setTimestamp();

        message.channel.send({ embeds: [exampleEmbed] }).then(msg => {
            msg.react(MaleEmoji);
            msg.react(FemaleEmoji);
            reactionPosts.push({ channelId: msg.channel.id, messageId: msg.id, embedId: exampleEmbed.id, reactions: [MaleEmoji, FemaleEmoji] });
            console.log(reactionPosts);
        });


    }
});

client.login(botToken);