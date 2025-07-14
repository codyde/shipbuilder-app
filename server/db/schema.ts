import { pgTable, text, timestamp, uuid, pgEnum, varchar, unique } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const taskStatusEnum = pgEnum('task_status', ['backlog', 'in_progress', 'completed']);
export const projectStatusEnum = pgEnum('project_status', ['active', 'backlog', 'completed', 'archived']);
export const priorityEnum = pgEnum('priority', ['low', 'medium', 'high']);
export const aiProviderEnum = pgEnum('ai_provider', ['anthropic', 'openai', 'xai']);

// Tables
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  provider: text('provider'), // 'github', 'google', 'fake', 'sentry'
  providerId: text('provider_id'),
  avatar: text('avatar'), // Avatar URL from OAuth provider
  aiProvider: aiProviderEnum('ai_provider').notNull().default('anthropic'), // AI provider preference
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
export const projects = pgTable('projects', {
  id: varchar('id', { length: 20 }).primaryKey(),
  userId: uuid('user_id').notNull().default('00000000-0000-0000-0000-000000000000').references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  status: projectStatusEnum('status').notNull().default('active'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  uniqueUserProject: unique().on(table.userId, table.id),
}));

export const tasks = pgTable('tasks', {
  id: varchar('id', { length: 20 }).primaryKey(),
  projectId: varchar('project_id', { length: 20 }).notNull().references(() => projects.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  details: text('details'),
  status: taskStatusEnum('status').notNull().default('backlog'),
  priority: priorityEnum('priority').notNull().default('medium'),
  dueDate: timestamp('due_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});


export const comments = pgTable('comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  taskId: varchar('task_id', { length: 20 }).notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  author: text('author').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  keyHash: text('key_hash').notNull(),
  prefix: text('prefix').notNull(), // Short prefix for identification (e.g., "sk_live_")
  createdAt: timestamp('created_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at'), // Optional expiration
  lastUsedAt: timestamp('last_used_at'),
  isActive: text('is_active').notNull().default('true'), // 'true' or 'false' as text
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects),
  apiKeys: many(apiKeys),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, {
    fields: [projects.userId],
    references: [users.id],
  }),
  tasks: many(tasks),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
  comments: many(comments),
}));


export const commentsRelations = relations(comments, ({ one }) => ({
  task: one(tasks, {
    fields: [comments.taskId],
    references: [tasks.id],
  }),
}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  user: one(users, {
    fields: [apiKeys.userId],
    references: [users.id],
  }),
}));