import dotenv from 'dotenv';
dotenv.config();

import { databaseService } from './server/db/database-service.js';

async function testDelete() {
  try {
    console.log('Testing database connection...');
    
    // Get all projects first
    const projects = await databaseService.getProjects('00000000-0000-0000-0000-000000000000');
    console.log('Found projects:', projects.length);
    
    if (projects.length > 0) {
      const projectToDelete = projects[0];
      console.log('Attempting to delete project:', projectToDelete.name, projectToDelete.id);
      
      // Try to delete
      const result = await databaseService.deleteProject(projectToDelete.id, '00000000-0000-0000-0000-000000000000');
      console.log('Delete result:', result);
    } else {
      console.log('No projects found to delete');
    }
    
  } catch (error) {
    console.error('Error:', error);
    console.error('Stack:', error.stack);
  }
  
  process.exit(0);
}

testDelete();