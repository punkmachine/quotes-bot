import sharp from 'sharp';
import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';

dotenv.config();

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

async function createQuoteImage(text, username, profilePhotoUrl) {
  try {
    const width = 800;
    const height = 340;
    const avatarSize = 200;
    const quoteTextSize = 24;
    const authorTextSize = 20;
    const textGap = 24;

    const avatarTop = Math.floor((height - avatarSize) / 2);

    const totalTextHeight = quoteTextSize + textGap + authorTextSize;
    const textBlockTop = Math.floor((height - totalTextHeight) / 2);
    const quoteY = textBlockTop + quoteTextSize;
    const authorY = quoteY + textGap + authorTextSize;

    let image = sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 1 }
      }
    });

    const titleSvg = Buffer.from(`
      <svg width="${width}" height="${height}">
        <text
          x="50%"
          y="50"
          text-anchor="middle"
          font-family="sans-serif"
          font-size="36px"
          font-weight="bold"
          fill="white"
        >Цитаты великих людей</text>
      </svg>
    `);

    const quoteSvg = Buffer.from(`
      <svg width="${width}" height="${height}">
        <text
          x="282"
          y="${quoteY}"
          font-family="sans-serif"
          font-size="${quoteTextSize}px"
          fill="white"
        >${text}</text>
      </svg>
    `);

    const authorSvg = Buffer.from(`
      <svg width="${width}" height="${height}">
        <text
          x="282"
          y="${authorY}"
          font-family="sans-serif"
          font-size="${authorTextSize}px"
          font-style="italic"
          fill="white"
        >© ${username}</text>
      </svg>
    `);

    const compositeElements = [];

    if (profilePhotoUrl) {
      try {
        const avatarBuffer = await fetch(profilePhotoUrl).then(res => res.arrayBuffer());
        const avatar = await sharp(Buffer.from(avatarBuffer))
          .resize(avatarSize, avatarSize)
          .composite([{
            input: Buffer.from(`
              <svg>
                <circle cx="100" cy="100" r="100" fill="white"/>
              </svg>
            `),
            blend: 'dest-in'
          }])
          .toBuffer();

        compositeElements.push({
          input: avatar,
          top: avatarTop,
          left: 50
        });
      } catch (error) {
        console.error('Error processing profile photo:', error);
      }
    }

    compositeElements.push(
      { input: titleSvg, top: 0, left: 0 },
      { input: quoteSvg, top: 0, left: 0 },
      { input: authorSvg, top: 0, left: 0 }
    );

    image = image.composite(compositeElements);

    return await image.png().toBuffer();
  } catch (error) {
    console.error('Error creating image:', error);
    throw error;
  }
}

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const isForward = 'forward_origin' in msg;

  try {
    const photos = await bot.getUserProfilePhotos(isForward ? msg.forward_origin.sender_user.id : msg.from.id);
    let photoUrl = null;
    if (photos.photos.length > 0) {
      const photo = photos.photos[0][0];
      const file = await bot.getFile(photo.file_id);
      photoUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
    }

    const firstName = isForward ? msg.forward_origin.sender_user.first_name : msg.from.first_name;
    const lastName = isForward ? msg.forward_origin.sender_user.last_name : msg.from.last_name;
    const fullName = [firstName, lastName].filter(Boolean).join(' ');

    const quoteImage = await createQuoteImage(
      msg.text,
      fullName,
      photoUrl
    );

    await bot.sendPhoto(chatId, quoteImage);
  } catch (error) {
    console.error('Complete error:', error);
    await bot.sendMessage(chatId, 'Произошла ошибка при создании изображения. Пожалуйста, попробуйте еще раз.');
  }
});

console.log('Bot is running...');