import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { AppNotification, Task, NotificationType } from '../types';
import { calculateDaysRemaining } from './taskService';

const COLLECTION_NAME = 'notifications';

export const notificationService = {
  async getForUser(userId: string): Promise<AppNotification[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('userId', '==', userId),
        limit(50)
      );
      const snapshot = await getDocs(q);
      const notifications = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as AppNotification[];

      return notifications.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } catch (err) {
      console.error(`Error fetching notifications for user ${userId}:`, err);
      return [];
    }
  },

  async create(data: Omit<AppNotification, 'id' | 'createdAt'>): Promise<AppNotification> {
    const docRef = doc(collection(db, COLLECTION_NAME));
    const now = new Date().toISOString();

    const notif: AppNotification = {
      ...data,
      id: docRef.id,
      createdAt: now,
    };

    await setDoc(docRef, notif);
    return notif;
  },

  async markAsRead(id: string): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, { read: true });
  },

  async markAllAsRead(userId: string, notifications: AppNotification[]): Promise<void> {
    const unread = notifications.filter((n) => !n.read && n.userId === userId);
    await Promise.all(unread.map((n) => this.markAsRead(n.id)));
  },

  // Evaluate user tasks to generate system notifications if overdue or due today
  async checkTaskAlerts(userId: string, tasks: Task[]): Promise<void> {
    const userTasks = tasks.filter(
      (t) => t.assignedTo === userId && t.status !== 'COMPLETED' && t.status !== 'CANCELLED'
    );

    const existing = await this.getForUser(userId);
    const existingRelatedIds = new Set(existing.map((n) => `${n.type}_${n.relatedEntityId}`));

    for (const task of userTasks) {
      const days = calculateDaysRemaining(task.dueDate);

      if (days < 0) {
        const key = `TASK_OVERDUE_${task.id}`;
        if (!existingRelatedIds.has(key)) {
          await this.create({
            userId,
            type: 'TASK_OVERDUE',
            title: `Action Overdue: ${task.title}`,
            message: `Task is ${Math.abs(days)} day(s) overdue (due ${new Date(task.dueDate).toLocaleDateString()}).`,
            relatedEntityType: 'task',
            relatedEntityId: task.id,
            read: false,
          });
        }
      } else if (days === 0) {
        const key = `TASK_DUE_TODAY_${task.id}`;
        if (!existingRelatedIds.has(key)) {
          await this.create({
            userId,
            type: 'TASK_DUE_TODAY',
            title: `Task Due Today: ${task.title}`,
            message: `You have an action scheduled for completion today.`,
            relatedEntityType: 'task',
            relatedEntityId: task.id,
            read: false,
          });
        }
      }
    }
  },
};
