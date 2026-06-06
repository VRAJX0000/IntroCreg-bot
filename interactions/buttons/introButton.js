const { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, Collection, MessageFlags } = require('discord.js');
const { hasSubmitted } = require('../../utils/persistence');

// Cooldown collection: userId -> timestamp
const cooldowns = new Collection();
const COOLDOWN_SECONDS = 30;

module.exports = {
    id: 'intro_submit_btn',
    /**
     * @param {import('discord.js').ButtonInteraction} interaction 
     */
    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;
        const { t } = require('../../utils/lang');



        // 1. Persistence Check
        const { getSubmission } = require('../../utils/persistence');
        const submission = await getSubmission(interaction.guild.id, userId);

        if (submission) {
            const status = submission.status || 'approved'; // Legacy data defaults to approved

            if (status === 'pending') {
                return interaction.reply({
                    content: '⏳ You have a submission **awaiting approval**! Please wait for a moderator to review it.',
                    flags: MessageFlags.Ephemeral
                });
            } else {
                return interaction.reply({
                    content: t('intro.already_submitted', guildId),
                    flags: MessageFlags.Ephemeral
                });
            }
        }

        // 2. Rate Limiting
        if (cooldowns.has(userId)) {
            const expirationTime = cooldowns.get(userId) + COOLDOWN_SECONDS * 1000;
            const now = Date.now();

            if (now < expirationTime) {
                const timeLeft = Math.round((expirationTime - now) / 1000);
                return interaction.reply({
                    content: `⏳ Please wait ${timeLeft} seconds before trying again.`,
                    flags: MessageFlags.Ephemeral
                });
            }
        }

        // Set Cooldown
        cooldowns.set(userId, Date.now());
        setTimeout(() => cooldowns.delete(userId), COOLDOWN_SECONDS * 1000);

        const modal = new ModalBuilder()
            .setCustomId('introModal')
            .setTitle('User Introduction Form');

        // Name Input
        const nameInput = new TextInputBuilder()
            .setCustomId('nameInput')
            .setLabel("What's your name?")
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        // Age Input
        const ageInput = new TextInputBuilder()
            .setCustomId('ageInput')
            .setLabel("How old are you?")
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        // Profession Input
        const professionInput = new TextInputBuilder()
            .setCustomId('professionInput')
            .setLabel("What's your profession?")
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

        // Platform Input
        const platformInput = new TextInputBuilder()
            .setCustomId('platformInput')
            .setLabel("Platform (Mobile / PC / Console)")
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        // Game Input
        const gameInput = new TextInputBuilder()
            .setCustomId('gameInput')
            .setLabel("What do you do?")
            .setStyle(TextInputStyle.Paragraph)
            .setMinLength(11)
            .setRequired(true); // Assuming required since minLength is set

        // Add inputs to rows
        const firstActionRow = new ActionRowBuilder().addComponents(nameInput);
        const secondActionRow = new ActionRowBuilder().addComponents(ageInput);
        const thirdActionRow = new ActionRowBuilder().addComponents(professionInput);
        const fourthActionRow = new ActionRowBuilder().addComponents(platformInput);
        const fifthActionRow = new ActionRowBuilder().addComponents(gameInput);

        modal.addComponents(firstActionRow, secondActionRow, thirdActionRow, fourthActionRow, fifthActionRow);

        await interaction.showModal(modal);
    },
};
