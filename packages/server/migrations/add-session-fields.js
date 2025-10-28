#!/usr/bin/env node
'use strict';

/**
 * Database migration script to add session management fields to existing users
 *
 * This script adds the following fields to all user documents:
 * - activeSessionId: String (null by default)
 * - sessionCreatedAt: Date (null by default)
 * - lastActivity: Date (current date)
 * - lastLoginIp: String (null by default)
 * - lastLoginUserAgent: String (null by default)
 *
 * Usage: node packages/server/migrations/add-session-fields.js
 */

const mongoose = require('mongoose');
const config = require('../node.config.js');

async function migrate() {
  console.log('Starting migration: add session management fields to users...');

  try {
    // Connect to database
    console.log(`Connecting to database: ${config.database}`);
    await mongoose.connect(config.database, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to database successfully');

    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');

    // Count existing users
    const userCount = await usersCollection.countDocuments();
    console.log(`Found ${userCount} users to migrate`);

    if (userCount === 0) {
      console.log('No users found. Nothing to migrate.');
      await mongoose.connection.close();
      process.exit(0);
    }

    // Check if fields already exist
    const sampleUser = await usersCollection.findOne({});
    if (sampleUser && 'activeSessionId' in sampleUser) {
      console.log('WARNING: Session fields already exist. Migration may have already been run.');
      console.log('Do you want to continue anyway? (This will reset session fields to default values)');
      console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...');
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    // Add the new fields to all users
    const result = await usersCollection.updateMany(
      {},
      {
        $set: {
          activeSessionId: null,
          sessionCreatedAt: null,
          lastActivity: new Date(),
          lastLoginIp: null,
          lastLoginUserAgent: null,
        },
      }
    );

    console.log(`Migration completed successfully!`);
    console.log(`- ${result.matchedCount} users matched`);
    console.log(`- ${result.modifiedCount} users updated`);

    if (result.modifiedCount === 0 && result.matchedCount > 0) {
      console.log('Note: 0 users were modified because they already had these fields.');
    }

    await mongoose.connection.close();
    console.log('Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
}

// Run migration
migrate();
