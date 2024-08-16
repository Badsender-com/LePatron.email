// Connect to the MongoDB database
use badsender-development;

async function transformTags() {
try {
const startTime = new Date();
print(`Script started at: ${startTime}`);

    // Step 1: Check if the tags collection exists
    const collections = await db.getCollectionNames();
    if (!collections.includes('tags')) {
      await db.createCollection('tags');
      print('Created tags collection.');
    } else {
      print('Tags collection already exists.');
    }

    // Step 2: Process emails in batches
    const batchSize = 100;
    let skip = 0;
    let emails;

    while (true) {
      const batchStartTime = new Date();
      print(`Starting batch at: ${batchStartTime}`);
      print(`Attempting to retrieve batch starting from ${skip}`);

      // Retrieve a batch of emails
      emails = await db.creations.find().skip(skip).limit(batchSize).toArray();
      if (emails.length === 0) break;

      print(`Retrieved ${emails.length} emails`);

      // Step 3: Create a dictionary to store unique tags with their usageCount
      const tagDict = {};

      // Iterate over each email and each tag in the email to populate the dictionary
      emails.forEach((email) => {
        if (!Array.isArray(email.tags)) return;
        email.tags.forEach((tag) => {
          const key = `${tag}-${email._company}`;
          if (!tagDict[key]) {
            tagDict[key] = {
              label: tag,
              companyId: email._company,
              usageCount: 0,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
          }
          tagDict[key].usageCount += 1;
          tagDict[key].updatedAt = new Date();
        });
      });

      print(`Created tag dictionary with ${Object.keys(tagDict).length} unique tags`);

      // Step 4: Insert unique tags into the tags collection and get their IDs
      for (const key of Object.keys(tagDict)) {
        const tagData = tagDict[key];
        try {
          const existingTag = await db.tags.findOne({ label: tagData.label, companyId: tagData.companyId });
          if (existingTag) {
            await db.tags.updateOne(
              { _id: existingTag._id },
              {
                $set: {
                  usageCount: existingTag.usageCount + tagData.usageCount,
                  updatedAt: new Date(),
                }
              }
            );
          } else {
            await db.tags.insertOne(tagData);
          }
        } catch (err) {
          print(`Error processing tag ${key}: ${err}`);
        }
      }

      print('Tag insertion and update completed');

      const batchEndTime = new Date();
      const batchDuration = (batchEndTime - batchStartTime) / 1000;
      print(`Tag transformation completed for ${skip} to ${skip + batchSize} emails in ${batchDuration} seconds`);
      skip += batchSize;
    }

    const endTime = new Date();
    const totalDuration = (endTime - startTime) / 1000;
    print(`Tag transformation completed successfully in ${totalDuration} seconds`);

} catch (error) {
print('Error during tag transformation:', error);
}
}

// Call the main function
transformTags().catch(error => {
print('Error during tag transformation:', error);
});
