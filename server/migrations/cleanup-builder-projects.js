import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

import BuilderProject from '../models/BuilderProject.js';

async function cleanupDuplicates() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/arabian-blue-bloom', {
      dbName: process.env.MONGODB_DB || 'appdb'
    });

    console.log(`🔍 Finding all builder projects from ${process.env.MONGODB_DB}...`);
    const allProjects = await BuilderProject.find({ isDeleted: false })
      .select({ ownerActorKey: 1, title: 1, stats: 1 })
      .sort({ createdAt: -1 });
    
    console.log(`Found ${allProjects.length} total active projects.`);

    const seen = new Set();
    let deletedCount = 0;

    for (const project of allProjects) {
      // Duplicate logic:
      // Same owner + same title + same stats
      const signature = JSON.stringify({
        ownerActorKey: project.ownerActorKey,
        title: project.title,
        stats: {
          wallsCount: project.stats?.wallsCount,
          productsCount: project.stats?.productsCount
        }
      });

      if (seen.has(signature)) {
        await BuilderProject.deleteOne({ _id: project._id });
        deletedCount++;
      } else {
        seen.add(signature);
      }
    }

    console.log(`\n🎉 Cleanup completed! Deleted ${deletedCount} duplicate projects.`);
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
    process.exit(0);
  }
}

cleanupDuplicates();
