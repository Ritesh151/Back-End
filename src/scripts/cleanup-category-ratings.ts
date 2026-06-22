import { Lead } from '../models/Lead';
import { connectDB, disconnectDB } from '../config/database';
import { logger } from '../utils/logger';

const RATING_PATTERN = /^\d+(\.\d+)?$/;

async function cleanupCategoryField() {
  await connectDB();

  const allBadDocs = await Lead.find({
    category: { $regex: RATING_PATTERN, $options: '' },
  }).lean();

  const badCount = allBadDocs.length;
  logger.info(`Found ${badCount} leads with numeric/rating values in category field`);

  if (badCount === 0) {
    logger.info('No cleanup needed. Category field is clean.');
    await disconnectDB();
    return;
  }

  const sampleBad = allBadDocs.slice(0, 5).map((l: any) => ({
    companyName: l.companyName,
    category: l.category,
    rating: l.rating,
  }));
  logger.info({ sampleBad }, 'Sample bad leads');

  const updateResult = await Lead.updateMany(
    { category: { $regex: RATING_PATTERN, $options: '' } },
    { $unset: { category: '' } }
  );

  logger.info(
    `Cleaned ${updateResult.modifiedCount} leads — removed rating values from category field`
  );

  await disconnectDB();
}

cleanupCategoryField().catch((err) => {
  logger.error({ err }, 'Category cleanup failed');
  process.exit(1);
});
