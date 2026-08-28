import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import {
  Task,
  DynamicWorklistItem,
  TaskStatus,
  UserProfile,
} from '../types';

const COLLECTION_NAME = 'tasks';

export function calculateDaysRemaining(
  dueDateStr: string
): number {
  if (!dueDateStr) return 0;

  const due = new Date(dueDateStr);

  if (Number.isNaN(due.getTime())) {
    return 0;
  }

  const now = new Date();

  // Reset time portions for accurate
  // calendar-day differences.
  const dueDay = new Date(
    due.getFullYear(),
    due.getMonth(),
    due.getDate()
  );

  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  const diffTime =
    dueDay.getTime() -
    today.getTime();

  return Math.round(
    diffTime / (1000 * 60 * 60 * 24)
  );
}

const sortTasksByDueDate = (
  tasks: Task[]
): Task[] => {
  return [...tasks].sort(
    (a, b) =>
      new Date(a.dueDate).getTime() -
      new Date(b.dueDate).getTime()
  );
};

const isPrivilegedUser = (
  user: UserProfile | null | undefined
): boolean => {
  return (
    user?.role === 'ADMIN' ||
    user?.role === 'BDM_MANAGER'
  );
};

export const taskService = {
  async getAll(): Promise<Task[]> {
    try {
      const taskQuery = query(
        collection(db, COLLECTION_NAME),
        orderBy('dueDate', 'asc')
      );

      const snapshot =
        await getDocs(taskQuery);

      return snapshot.docs.map(
        (docSnap) =>
          ({
            id: docSnap.id,
            ...docSnap.data(),
          }) as Task
      );
    } catch (error) {
      console.error(
        'Error fetching tasks:',
        error
      );

      return [];
    }
  },

  async getByAssignedUser(
    userId: string
  ): Promise<Task[]> {
    try {
      const taskQuery = query(
        collection(db, COLLECTION_NAME),
        where(
          'assignedTo',
          '==',
          userId
        )
      );

      const snapshot =
        await getDocs(taskQuery);

      const tasks = snapshot.docs.map(
        (docSnap) =>
          ({
            id: docSnap.id,
            ...docSnap.data(),
          }) as Task
      );

      return sortTasksByDueDate(tasks);
    } catch (error) {
      console.error(
        `Error fetching assigned tasks for user ${userId}:`,
        error
      );

      return [];
    }
  },

  async getByCreatedUser(
    userId: string
  ): Promise<Task[]> {
    try {
      const taskQuery = query(
        collection(db, COLLECTION_NAME),
        where(
          'createdBy',
          '==',
          userId
        )
      );

      const snapshot =
        await getDocs(taskQuery);

      const tasks = snapshot.docs.map(
        (docSnap) =>
          ({
            id: docSnap.id,
            ...docSnap.data(),
          }) as Task
      );

      return sortTasksByDueDate(tasks);
    } catch (error) {
      console.error(
        `Error fetching created tasks for user ${userId}:`,
        error
      );

      return [];
    }
  },

  /**
   * Retrieves tasks accessible to the given user.
   *
   * ADMIN and BDM_MANAGER:
   *   All tasks.
   *
   * Other users:
   *   Tasks assigned to them plus tasks created by them.
   */
  async getTasksForUser(
    user: UserProfile | null
  ): Promise<Task[]> {
    if (!user) {
      return [];
    }

    if (isPrivilegedUser(user)) {
      return this.getAll();
    }

    try {
      const [
        assignedTasks,
        createdTasks,
      ] = await Promise.all([
        this.getByAssignedUser(
          user.uid
        ),
        this.getByCreatedUser(
          user.uid
        ),
      ]);

      const taskMap =
        new Map<string, Task>();

      assignedTasks.forEach(
        (task) =>
          taskMap.set(
            task.id,
            task
          )
      );

      createdTasks.forEach(
        (task) =>
          taskMap.set(
            task.id,
            task
          )
      );

      return sortTasksByDueDate(
        Array.from(
          taskMap.values()
        )
      );
    } catch (error) {
      console.error(
        'Error fetching accessible tasks for user:',
        error
      );

      return [];
    }
  },

  async getByOrganisation(
    organisationId: string,
    user?: UserProfile | null
  ): Promise<Task[]> {
    try {
      if (!organisationId) {
        return [];
      }

      // Privileged users retrieve all tasks
      // for the selected organisation.
      if (!user || isPrivilegedUser(user)) {
        const taskQuery = query(
          collection(
            db,
            COLLECTION_NAME
          ),
          where(
            'organisationId',
            '==',
            organisationId
          )
        );

        const snapshot =
          await getDocs(taskQuery);

        const tasks =
          snapshot.docs.map(
            (docSnap) =>
              ({
                id: docSnap.id,
                ...docSnap.data(),
              }) as Task
          );

        return sortTasksByDueDate(tasks);
      }

      // Standard users retrieve tasks where
      // they are either assigned owner or creator.
      const [
        assignedSnapshot,
        createdSnapshot,
      ] = await Promise.all([
        getDocs(
          query(
            collection(
              db,
              COLLECTION_NAME
            ),
            where(
              'organisationId',
              '==',
              organisationId
            ),
            where(
              'assignedTo',
              '==',
              user.uid
            )
          )
        ),

        getDocs(
          query(
            collection(
              db,
              COLLECTION_NAME
            ),
            where(
              'organisationId',
              '==',
              organisationId
            ),
            where(
              'createdBy',
              '==',
              user.uid
            )
          )
        ),
      ]);

      const taskMap =
        new Map<string, Task>();

      assignedSnapshot.docs.forEach(
        (docSnap) =>
          taskMap.set(
            docSnap.id,
            {
              id: docSnap.id,
              ...docSnap.data(),
            } as Task
          )
      );

      createdSnapshot.docs.forEach(
        (docSnap) =>
          taskMap.set(
            docSnap.id,
            {
              id: docSnap.id,
              ...docSnap.data(),
            } as Task
          )
      );

      return sortTasksByDueDate(
        Array.from(
          taskMap.values()
        )
      );
    } catch (error) {
      console.error(
        `Error fetching tasks for organisation ${organisationId}:`,
        error
      );

      return [];
    }
  },

  async getById(
    id: string
  ): Promise<Task | null> {
    try {
      const docRef = doc(
        db,
        COLLECTION_NAME,
        id
      );

      const docSnap =
        await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      return {
        id: docSnap.id,
        ...docSnap.data(),
      } as Task;
    } catch (error) {
      console.error(
        `Error fetching task ${id}:`,
        error
      );

      return null;
    }
  },

  async create(
    data: Omit<
      Task,
      | 'id'
      | 'createdAt'
      | 'updatedAt'
      | 'completedDate'
      | 'completedBy'
    > & {
      completedDate?: string | null;
      completedBy?: string | null;
    }
  ): Promise<Task> {
    const currentUid =
      auth.currentUser?.uid;

    if (!currentUid) {
      throw new Error(
        'Authentication required to create a task.'
      );
    }

    const docRef = doc(
      collection(
        db,
        COLLECTION_NAME
      )
    );

    const now =
      new Date().toISOString();

    const newTask: Task = {
      ...data,

      id: docRef.id,

      // Never trust the caller for audit ownership.
      createdBy: currentUid,
      updatedBy: currentUid,

      contactId:
        data.contactId || null,

      engagementId:
        data.engagementId || null,

      opportunityId:
        data.opportunityId || null,

      completedDate:
        data.completedDate || null,

      completedBy:
        data.completedBy || null,

      createdAt: now,
      updatedAt: now,
    };

    await setDoc(
      docRef,
      newTask
    );

    return newTask;
  },

  async update(
    id: string,
    data: Partial<Task>
  ): Promise<void> {
    const currentUid =
      auth.currentUser?.uid;

    if (!currentUid) {
      throw new Error(
        'Authentication required to update a task.'
      );
    }

    const docRef = doc(
      db,
      COLLECTION_NAME,
      id
    );

    const updatePayload: Record<
      string,
      any
    > = {
      ...data,

      // Server-side Firestore rules must
      // ultimately enforce authorization.
      updatedBy:
        currentUid,

      updatedAt:
        new Date().toISOString(),
    };

    await updateDoc(
      docRef,
      updatePayload
    );
  },

  async toggleStatus(
    id: string,
    currentStatus: TaskStatus,
    userId?: string
  ): Promise<TaskStatus> {
    const currentUid =
      auth.currentUser?.uid;

    if (!currentUid) {
      throw new Error(
        'Authentication required to change task status.'
      );
    }

    // Cancelled tasks must be explicitly
    // reopened through an edit workflow.
    if (currentStatus === 'CANCELLED') {
      throw new Error(
        'Cancelled tasks cannot be toggled directly.'
      );
    }

    const nextStatus: TaskStatus =
      currentStatus === 'COMPLETED'
        ? 'OPEN'
        : 'COMPLETED';

    const now =
      new Date().toISOString();

    await this.update(id, {
      status: nextStatus,

      completedDate:
        nextStatus === 'COMPLETED'
          ? now
          : null,

      completedBy:
        nextStatus === 'COMPLETED'
          ? currentUid
          : null,
    });

    return nextStatus;
  },

  async delete(
    id: string
  ): Promise<void> {
    const currentUid =
      auth.currentUser?.uid;

    if (!currentUid) {
      throw new Error(
        'Authentication required to delete a task.'
      );
    }

    const docRef = doc(
      db,
      COLLECTION_NAME,
      id
    );

    await deleteDoc(docRef);
  },

  /**
   * Dynamically classifies tasks for worklist
   * and dashboard presentation.
   */
  classifyTasks(tasks: Task[]): {
    overdue: DynamicWorklistItem[];
    dueToday: DynamicWorklistItem[];
    dueThisWeek: DynamicWorklistItem[];
    upcoming: DynamicWorklistItem[];
    completed: DynamicWorklistItem[];
  } {
    const overdue: DynamicWorklistItem[] = [];
    const dueToday: DynamicWorklistItem[] = [];
    const dueThisWeek: DynamicWorklistItem[] = [];
    const upcoming: DynamicWorklistItem[] = [];
    const completed: DynamicWorklistItem[] = [];

    tasks.forEach((task) => {
      const daysRemaining =
        calculateDaysRemaining(
          task.dueDate
        );

      const isClosed =
        task.status === 'COMPLETED' ||
        task.status === 'CANCELLED';

      const item: DynamicWorklistItem = {
        ...task,

        daysRemaining,

        isOverdue:
          !isClosed &&
          daysRemaining < 0,
      };

      if (isClosed) {
        completed.push(item);
      } else if (
        daysRemaining < 0
      ) {
        overdue.push(item);
      } else if (
        daysRemaining === 0
      ) {
        dueToday.push(item);
      } else if (
        daysRemaining <= 7
      ) {
        dueThisWeek.push(item);
      } else {
        upcoming.push(item);
      }
    });

    // Most overdue first.
    overdue.sort(
      (a, b) =>
        a.daysRemaining -
        b.daysRemaining
    );

    // Closest active due date first.
    dueToday.sort(
      (a, b) =>
        new Date(
          a.dueDate
        ).getTime() -
        new Date(
          b.dueDate
        ).getTime()
    );

    dueThisWeek.sort(
      (a, b) =>
        a.daysRemaining -
        b.daysRemaining
    );

    upcoming.sort(
      (a, b) =>
        a.daysRemaining -
        b.daysRemaining
    );

    // Most recently completed/updated first.
    completed.sort(
      (a, b) => {
        const aDate =
          a.completedDate ||
          a.updatedAt;

        const bDate =
          b.completedDate ||
          b.updatedAt;

        return (
          new Date(
            bDate
          ).getTime() -
          new Date(
            aDate
          ).getTime()
        );
      }
    );

    return {
      overdue,
      dueToday,
      dueThisWeek,
      upcoming,
      completed,
    };
  },
};