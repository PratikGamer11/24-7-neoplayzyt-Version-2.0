const mineflayer = require('mineflayer');
const { Movements, pathfinder, goals } = require('mineflayer-pathfinder');
const { GoalBlock, GoalXZ } = goals;

const config = require('./settings.json');

const loggers = require('./logging.js');
const logger = loggers.logger;

function createBot() {

   const bot = mineflayer.createBot({
      username: config['bot-account']['username'],
      password: config['bot-account']['password'],
      auth: config['bot-account']['type'],
      host: config.server.ip,
      port: config.server.port,
      version: config.server.version
   });

   bot.loadPlugin(pathfinder);
   bot.settings.colorsEnabled = false;

   bot.once('spawn', () => {
      logger.info("Bot joined the server");

      // Safe mcData load
      const mcData = require('minecraft-data')(bot.version);
      const defaultMove = new Movements(bot, mcData);
      bot.pathfinder.setMovements(defaultMove);

      // Auto Auth
      if (config.utils['auto-auth'].enabled) {
         const password = config.utils['auto-auth'].password;
         setTimeout(() => {
            bot.chat(`/register ${password} ${password}`);
            bot.chat(`/login ${password}`);
         }, 500);
         logger.info(`Authentication commands executed`);
      }

      // Chat messages
      if (config.utils['chat-messages'].enabled) {
         const messages = config.utils['chat-messages'].messages;

         if (config.utils['chat-messages'].repeat) {
            let delay = config.utils['chat-messages']['repeat-delay'];
            let i = 0;

            setInterval(() => {
               bot.chat(messages[i]);
               i = (i + 1) % messages.length;
            }, delay * 1000);
         } else {
            messages.forEach(msg => bot.chat(msg));
         }
      }

      // Move to position
      if (config.position.enabled) {
         const pos = config.position;
         logger.info(`Moving to target (${pos.x}, ${pos.y}, ${pos.z})`);
         bot.pathfinder.setGoal(new GoalBlock(pos.x, pos.y, pos.z));
      }

      // Anti AFK
      if (config.utils['anti-afk'].enabled) {

         if (config.utils['anti-afk'].sneak) bot.setControlState('sneak', true);
         if (config.utils['anti-afk'].jump) bot.setControlState('jump', true);

         if (config.utils['anti-afk'].hit.enabled) {
            const delay = config.utils['anti-afk'].hit.delay;
            const attackMobs = config.utils['anti-afk'].hit['attack-mobs'];

            setInterval(() => {
               if (attackMobs) {
                  const entity = bot.nearestEntity(e =>
                     e.type !== 'object' && e.type !== 'player'
                  );
                  if (entity) return bot.attack(entity);
               }
               bot.swingArm('right', true);
            }, delay);
         }

         if (config.utils['anti-afk'].rotate) {
            setInterval(() => {
               if (!bot.entity) return;
               bot.look(bot.entity.yaw + 1, bot.entity.pitch, true);
            }, 100);
         }

         if (config.utils['anti-afk']['circle-walk'].enabled) {
            circleWalk(bot, config.utils['anti-afk']['circle-walk'].radius);
         }
      }
   });

   bot.on('chat', (username, message) => {
      if (config.utils['chat-log']) {
         logger.info(`<${username}> ${message}`);
      }
   });

   bot.on('goal_reached', () => {
      if (config.position.enabled) {
         logger.info(`Arrived at target: ${bot.entity.position}`);
      }
   });

   bot.on('death', () => {
      logger.warn(`Bot died and respawned at ${bot.entity.position}`);
   });

   // Auto reconnect
   if (config.utils['auto-reconnect']) {
      bot.on('end', () => {
         logger.warn("Disconnected. Reconnecting...");
         setTimeout(createBot, config.utils['auto-reconnect-delay']);
      });
   }

   // 🔥 FIXED KICK HANDLER
   bot.on('kicked', (reason) => {
      try {
         let text = '';

         if (!reason) text = 'No reason';
         else if (typeof reason === 'string') text = reason;
         else if (reason.text) text = reason.text;
         else if (reason.extra) text = reason.extra.map(e => e.text).join('');
         else text = JSON.stringify(reason);

         text = text.replace(/§./g, '');
         logger.warn(`Bot was kicked. Reason: ${text}`);
      } catch (err) {
         logger.error(`Kick parse error: ${err.message}`);
      }
   });

   bot.on('error', err => logger.error(err.message));
}

function circleWalk(bot, radius) {
   const pos = bot.entity.position;

   const points = [
      [pos.x + radius, pos.z],
      [pos.x, pos.z + radius],
      [pos.x - radius, pos.z],
      [pos.x, pos.z - radius]
   ];

   let i = 0;
   setInterval(() => {
      if (!bot.entity) return;
      bot.pathfinder.setGoal(new GoalXZ(points[i][0], points[i][1]));
      i = (i + 1) % points.length;
   }, 1000);
}

createBot();
