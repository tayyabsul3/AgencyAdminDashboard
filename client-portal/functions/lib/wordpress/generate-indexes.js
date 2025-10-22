/**
 * Generate Firestore index configuration for WordPress integration
 * This script creates the firestore.indexes.json file needed for Firebase deployment
 */

const fs = require('fs');
const path = require('path');
const { DatabaseSchemaManager } = require('./schema-validation');

/**
 * Generate Firestore indexes configuration
 */
function generateFirestoreIndexes() {
  const indexes = DatabaseSchemaManager.getRequiredIndexes();
  
  // Convert to Firebase CLI format
  const firestoreIndexes = {
    indexes: indexes.map(index => ({
      collectionGroup: index.collection,
      queryScope: 'COLLECTION',
      fields: index.fields.map(field => ({
        fieldPath: field.field,
        order: field.order
      }))
    }))
  };
  
  return firestoreIndexes;
}

/**
 * Write indexes to firestore.indexes.json file
 */
function writeIndexesFile() {
  const indexes = generateFirestoreIndexes();
  const projectRoot = path.resolve(__dirname, '../../../..');
  const indexesPath = path.join(projectRoot, 'firestore.indexes.json');
  
  // Check if file already exists
  let existingIndexes = { indexes: [] };
  if (fs.existsSync(indexesPath)) {
    try {
      const existingContent = fs.readFileSync(indexesPath, 'utf8');
      existingIndexes = JSON.parse(existingContent);
    } catch (error) {
      console.warn('Could not parse existing firestore.indexes.json, creating new file');
    }
  }
  
  // Merge with existing indexes (avoid duplicates)
  const allIndexes = [...existingIndexes.indexes];
  
  for (const newIndex of indexes.indexes) {
    const isDuplicate = allIndexes.some(existing => 
      existing.collectionGroup === newIndex.collectionGroup &&
      JSON.stringify(existing.fields) === JSON.stringify(newIndex.fields)
    );
    
    if (!isDuplicate) {
      allIndexes.push(newIndex);
    }
  }
  
  const finalConfig = {
    indexes: allIndexes
  };
  
  fs.writeFileSync(indexesPath, JSON.stringify(finalConfig, null, 2));
  
  console.log(`✅ Firestore indexes written to ${indexesPath}`);
  console.log(`📊 Total indexes: ${finalConfig.indexes.length}`);
  console.log(`🆕 WordPress indexes added: ${indexes.indexes.length}`);
  
  return indexesPath;
}

/**
 * Display index information
 */
function displayIndexInfo() {
  const indexes = DatabaseSchemaManager.getRequiredIndexes();
  
  console.log('\n📋 Required WordPress Database Indexes:');
  console.log('=====================================');
  
  indexes.forEach((index, i) => {
    console.log(`\n${i + 1}. Collection: ${index.collection}`);
    console.log('   Fields:');
    index.fields.forEach(field => {
      console.log(`   - ${field.field} (${field.order})`);
    });
  });
  
  console.log('\n💡 To deploy these indexes:');
  console.log('   1. Run: firebase deploy --only firestore:indexes');
  console.log('   2. Or use Firebase Console to create indexes manually');
  
  console.log('\n⚠️  Note: Index creation can take several minutes in production');
}

// Run if called directly
if (require.main === module) {
  console.log('🔧 Generating WordPress Firestore indexes...\n');
  
  try {
    displayIndexInfo();
    writeIndexesFile();
    
    console.log('\n✨ Index generation complete!');
  } catch (error) {
    console.error('❌ Error generating indexes:', error.message);
    process.exit(1);
  }
}

module.exports = {
  generateFirestoreIndexes,
  writeIndexesFile,
  displayIndexInfo
};