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
import { Contact, HierarchyNode } from '../types';

const COLLECTION_NAME = 'contacts';

type ContactCreateData = Omit<
  Contact,
  'id' | 'fullName' | 'createdAt' | 'updatedAt'
>;

type ContactUpdateData = Partial<
  Omit<
    Contact,
    'id' | 'createdAt' | 'createdBy'
  >
>;

const normaliseNamePart = (value?: string): string =>
  (value || '').trim();

const buildFullName = (
  firstName: string,
  lastName: string
): string =>
  `${firstName.trim()} ${lastName.trim()}`.trim();

export const contactService = {
  async getAll(): Promise<Contact[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        orderBy('fullName', 'asc')
      );

      const snapshot = await getDocs(q);

      return snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as Contact[];
    } catch (err) {
      console.error(
        'Error fetching contacts:',
        err
      );

      return [];
    }
  },

  async getByOrganisation(
    organisationId: string
  ): Promise<Contact[]> {
    try {
      if (!organisationId) {
        return [];
      }

      const q = query(
        collection(db, COLLECTION_NAME),
        where(
          'organisationId',
          '==',
          organisationId
        )
      );

      const snapshot = await getDocs(q);

      const contacts =
        snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as Contact[];

      return contacts.sort((a, b) =>
        a.fullName.localeCompare(
          b.fullName
        )
      );
    } catch (err) {
      console.error(
        `Error fetching contacts for organisation ${organisationId}:`,
        err
      );

      return [];
    }
  },

  async getById(
    id: string
  ): Promise<Contact | null> {
    try {
      if (!id) {
        return null;
      }

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
      } as Contact;
    } catch (err) {
      console.error(
        `Error fetching contact ${id}:`,
        err
      );

      return null;
    }
  },

  /**
   * Validates that the selected reporting manager:
   *
   * 1. Exists.
   * 2. Belongs to the same organisation.
   * 3. Is not the contact itself.
   * 4. Does not create a circular reporting chain.
   */
  async validateReportingRelationship(
    organisationId: string,
    reportsToContactId: string | null,
    contactId?: string
  ): Promise<void> {
    if (!reportsToContactId) {
      return;
    }

    if (contactId && reportsToContactId === contactId) {
      throw new Error(
        'A contact cannot report to itself.'
      );
    }

    const manager =
      await this.getById(
        reportsToContactId
      );

    if (!manager) {
      throw new Error(
        'The selected reporting manager no longer exists.'
      );
    }

    if (
      manager.organisationId !==
      organisationId
    ) {
      throw new Error(
        'The selected reporting manager must belong to the same organisation.'
      );
    }

    /*
     * Circular hierarchy protection.
     *
     * Starting from the proposed manager, walk
     * upwards through the reporting chain.
     *
     * If we encounter the contact being updated,
     * the proposed relationship would create a loop.
     */
    if (contactId) {
      const visited =
        new Set<string>();

      let currentId:
        | string
        | null
        | undefined =
        reportsToContactId;

      while (currentId) {
        if (currentId === contactId) {
          throw new Error(
            'This reporting relationship would create a circular hierarchy.'
          );
        }

        if (visited.has(currentId)) {
          throw new Error(
            'The existing reporting hierarchy contains a circular relationship.'
          );
        }

        visited.add(currentId);

        const current =
          currentId === reportsToContactId
            ? manager
            : await this.getById(
                currentId
              );

        if (!current) {
          /*
           * Broken legacy hierarchy.
           *
           * The selected manager was already validated,
           * so a missing parent higher in the chain does
           * not invalidate the immediate relationship.
           */
          break;
        }

        currentId =
          current.reportsToContactId;
      }
    }
  },

  async create(
    data: ContactCreateData
  ): Promise<Contact> {
    const currentUid =
      auth.currentUser?.uid;

    if (!currentUid) {
      throw new Error(
        'Authentication required to create a contact.'
      );
    }

    const organisationId =
      data.organisationId?.trim();

    const firstName =
      normaliseNamePart(
        data.firstName
      );

    const lastName =
      normaliseNamePart(
        data.lastName
      );

    const jobTitle =
      normaliseNamePart(
        data.jobTitle
      );

    if (!organisationId) {
      throw new Error(
        'A valid organisation is required to create a contact.'
      );
    }

    if (!firstName || !lastName) {
      throw new Error(
        'First Name and Last Name are required.'
      );
    }

    if (!jobTitle) {
      throw new Error(
        'Job Title is required.'
      );
    }

    const reportsToContactId =
      data.reportsToContactId || null;

    await this.validateReportingRelationship(
      organisationId,
      reportsToContactId
    );

    const docRef = doc(
      collection(
        db,
        COLLECTION_NAME
      )
    );

    const now =
      new Date().toISOString();

    const newContact: Contact = {
      ...data,

      id: docRef.id,

      organisationId,

      firstName,

      lastName,

      fullName: buildFullName(
        firstName,
        lastName
      ),

      jobTitle,

      department:
        data.department?.trim() ||
        '',

      mobile:
        data.mobile?.trim() ||
        '',

      landline:
        data.landline?.trim() ||
        '',

      email:
        data.email?.trim() ||
        '',

      gender:
        data.gender || null,

      reportsToContactId,

      notes:
        data.notes?.trim() ||
        '',

      /*
       * Never trust audit identities supplied
       * by the caller.
       */
      createdBy: currentUid,

      updatedBy: currentUid,

      createdAt: now,

      updatedAt: now,
    };

    await setDoc(
      docRef,
      newContact
    );

    return newContact;
  },

  async update(
    id: string,
    data: ContactUpdateData
  ): Promise<void> {
    const currentUid =
      auth.currentUser?.uid;

    if (!currentUid) {
      throw new Error(
        'Authentication required to update a contact.'
      );
    }

    if (!id) {
      throw new Error(
        'A valid contact ID is required.'
      );
    }

    const existing =
      await this.getById(id);

    if (!existing) {
      throw new Error(
        'The contact you are trying to update no longer exists.'
      );
    }

    /*
     * Organisation ownership is immutable.
     *
     * The service layer enforces this even if a
     * future UI, import tool, or API path tries
     * to bypass the form restriction.
     */
    if (
      data.organisationId !== undefined &&
      data.organisationId !==
        existing.organisationId
    ) {
      throw new Error(
        'A contact cannot be moved to another organisation. Create a new contact instead.'
      );
    }

    const organisationId =
      existing.organisationId;

    const firstName =
      data.firstName !== undefined
        ? normaliseNamePart(
            data.firstName
          )
        : existing.firstName;

    const lastName =
      data.lastName !== undefined
        ? normaliseNamePart(
            data.lastName
          )
        : existing.lastName;

    const jobTitle =
      data.jobTitle !== undefined
        ? normaliseNamePart(
            data.jobTitle
          )
        : existing.jobTitle;

    if (!firstName || !lastName) {
      throw new Error(
        'First Name and Last Name are required.'
      );
    }

    if (!jobTitle) {
      throw new Error(
        'Job Title is required.'
      );
    }

    const reportsToContactId =
      data.reportsToContactId !==
      undefined
        ? data.reportsToContactId ||
          null
        : existing.reportsToContactId ||
          null;

    await this.validateReportingRelationship(
      organisationId,
      reportsToContactId,
      id
    );

    const updatePayload:
      Record<string, unknown> = {
        ...data,

        /*
         * Force immutable organisation ownership.
         */
        organisationId,

        firstName,

        lastName,

        fullName: buildFullName(
          firstName,
          lastName
        ),

        jobTitle,

        reportsToContactId,

        /*
         * Audit identity is always derived from
         * the authenticated Firebase user.
         */
        updatedBy: currentUid,

        updatedAt:
          new Date().toISOString(),
      };

    /*
     * createdBy must never be changed through
     * the update operation.
     */
    delete updatePayload.createdBy;

    /*
     * A caller cannot override the Firestore
     * document ID through the payload.
     */
    delete updatePayload.id;

    /*
     * Preserve the original creation timestamp.
     */
    delete updatePayload.createdAt;

    await updateDoc(
      doc(
        db,
        COLLECTION_NAME,
        id
      ),
      updatePayload
    );
  },

  async delete(
    id: string
  ): Promise<void> {
    const currentUid =
      auth.currentUser?.uid;

    if (!currentUid) {
      throw new Error(
        'Authentication required to delete a contact.'
      );
    }

    if (!id) {
      throw new Error(
        'A valid contact ID is required.'
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
   * Builds the command-chain hierarchy.
   *
   * Contacts that cannot be safely attached to
   * the hierarchy are returned in `unlinked`.
   *
   * This includes:
   * - Missing reporting managers.
   * - Self-referencing contacts.
   * - Contacts involved in circular chains.
   */
  buildHierarchy(
    contacts: Contact[]
  ): {
    tree: HierarchyNode[];
    unlinked: Contact[];
  } {
    if (
      !contacts ||
      contacts.length === 0
    ) {
      return {
        tree: [],
        unlinked: [],
      };
    }

    const contactMap =
      new Map<string, Contact>();

    contacts.forEach((contact) => {
      contactMap.set(
        contact.id,
        contact
      );
    });

    const childrenMap =
      new Map<
        string,
        Contact[]
      >();

    const roots: Contact[] = [];

    const unlinkedMap =
      new Map<string, Contact>();

    /*
     * First classify every contact.
     */
    contacts.forEach((contact) => {
      const parentId =
        contact.reportsToContactId;

      if (!parentId) {
        roots.push(contact);
        return;
      }

      if (
        parentId === contact.id
      ) {
        unlinkedMap.set(
          contact.id,
          contact
        );
        return;
      }

      if (
        !contactMap.has(parentId)
      ) {
        unlinkedMap.set(
          contact.id,
          contact
        );
        return;
      }

      const children =
        childrenMap.get(parentId) ||
        [];

      children.push(contact);

      childrenMap.set(
        parentId,
        children
      );
    });

    /*
     * Sort all hierarchy branches for consistent
     * rendering regardless of Firestore order.
     */
    roots.sort((a, b) =>
      a.fullName.localeCompare(
        b.fullName
      )
    );

    childrenMap.forEach(
      (children) => {
        children.sort((a, b) =>
          a.fullName.localeCompare(
            b.fullName
          )
        );
      }
    );

    const globallyVisited =
      new Set<string>();

    const buildNode = (
      contact: Contact,
      ancestry: Set<string>
    ): HierarchyNode | null => {
      /*
       * Detect a circular relationship within
       * the current ancestry path.
       */
      if (
        ancestry.has(contact.id)
      ) {
        unlinkedMap.set(
          contact.id,
          contact
        );

        return null;
      }

      /*
       * Prevent the same contact from appearing
       * multiple times in a malformed graph.
       */
      if (
        globallyVisited.has(
          contact.id
        )
      ) {
        return null;
      }

      globallyVisited.add(
        contact.id
      );

      const nextAncestry =
        new Set(ancestry);

      nextAncestry.add(
        contact.id
      );

      const childContacts =
        childrenMap.get(
          contact.id
        ) || [];

      const children:
        HierarchyNode[] = [];

      for (
        const child of childContacts
      ) {
        if (
          nextAncestry.has(
            child.id
          )
        ) {
          unlinkedMap.set(
            child.id,
            child
          );

          continue;
        }

        const childNode =
          buildNode(
            child,
            nextAncestry
          );

        if (childNode) {
          children.push(
            childNode
          );
        }
      }

      return {
        contact,
        children,
      };
    };

    const tree: HierarchyNode[] =
      [];

    for (
      const root of roots
    ) {
      const node =
        buildNode(
          root,
          new Set<string>()
        );

      if (node) {
        tree.push(node);
      }
    }

    /*
     * Any contact not reached from a valid root
     * belongs to a disconnected or circular
     * component and must not silently disappear.
     */
    contacts.forEach((contact) => {
      if (
        !globallyVisited.has(
          contact.id
        )
      ) {
        unlinkedMap.set(
          contact.id,
          contact
        );
      }
    });

    const unlinked = Array.from(
      unlinkedMap.values()
    ).sort((a, b) =>
      a.fullName.localeCompare(
        b.fullName
      )
    );

    return {
      tree,
      unlinked,
    };
  },
};