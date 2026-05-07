import { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from './supabase';

export const db = {};
export const auth = supabase.auth;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  console.error("DB Error", error, operationType, path);
  throw new Error(error instanceof Error ? error.message : String(error));
}

// ---- AUTH ----
export async function signInWithEmailAndPassword(authInst: any, email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return { user: { uid: data.user.id, email: data.user.email } };
}

export async function createUserWithEmailAndPassword(authInst: any, email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return { user: { uid: data.user.id, email: data.user.email } };
}

export async function signOut(authInst: any) {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export function onAuthStateChanged(authInst: any, callback: (user: any | null) => void) {
  const checkSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      callback({ uid: session.user.id, email: session.user.email });
    } else {
      callback(null);
    }
  };
  checkSession();

  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    if (session?.user) {
      callback({ uid: session.user.id, email: session.user.email });
    } else {
      callback(null);
    }
  });
  return () => {
    subscription.unsubscribe();
  };
}

export async function sendPasswordResetEmail(authInst: any, email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
}

export async function confirmPasswordReset(authInst: any, oobCode: string, newPassword: string) {
  // Using an implicit 'update user' since Supabase usually exchanges code to session dynamically
  // If we assume oobCode is used or login works via OTP:
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

// ---- FIRESTORE COMPAT ----

export function collection(dbInst: any, path: string) {
  return { _isCollection: true, path };
}

export function doc(dbInst: any, path: string, id?: string) {
  if (!id) {
    // some cases use doc(collection), not strictly allowed in our app
    throw new Error("unsupported");
  }
  return { _isDoc: true, path, id };
}

class Query {
  constructor(public collectionPath: string, public wheres: any[] = [], public orderBys: any[] = [], public limits: number | null = null) {}
}

export function query(collectionRef: any, ...constraints: any[]) {
  const wheres = [];
  const orderBys = [];
  let limits = null;

  for (const c of constraints) {
    if (c.type === 'where') wheres.push(c);
    if (c.type === 'orderBy') orderBys.push(c);
    if (c.type === 'limit') limits = c.value;
  }
  return new Query(collectionRef.path, wheres, orderBys, limits);
}

export function where(field: string, op: string, value: any) {
  return { type: 'where', field, op, value };
}

export function orderBy(field: string, direction: 'asc' | 'desc' = 'asc') {
  return { type: 'orderBy', field, direction };
}

export function limit(value: number) {
  return { type: 'limit', value };
}

export async function getDocs(queryObj: any) {
  let table = typeof queryObj.collectionPath === 'string' ? queryObj.collectionPath : queryObj.path;
  let q: any = supabase.from(table).select('*');
  
  if (queryObj.wheres) {
    for (const w of queryObj.wheres) {
      if (w.op === '==') q = q.eq(w.field, w.value);
      else if (w.op === '>=') q = q.gte(w.field, w.value);
      else if (w.op === '<=') q = q.lte(w.field, w.value);
      else if (w.op === '<') q = q.lt(w.field, w.value);
      else if (w.op === '>') q = q.gt(w.field, w.value);
    }
  }

  if (queryObj.orderBys) {
    for (const o of queryObj.orderBys) {
      q = q.order(o.field, { ascending: o.direction === 'asc' });
    }
  }

  if (queryObj.limits) {
    q = q.limit(queryObj.limits);
  }

  const { data, error } = await q;
  if (error) throw error;

  return {
    empty: data.length === 0,
    size: data.length,
    docs: data.map((d: any) => ({
      id: d.id, // Ensure primary key is returned
      data: () => d,
      ref: { _isDoc: true, path: table, id: d.id }
    }))
  };
}

export async function getDoc(docRef: any) {
  const { data, error } = await supabase.from(docRef.path).select('*').eq('id', docRef.id).maybeSingle();
  if (error) throw error;
  if (!data) return { exists: () => false, id: docRef.id, data: () => undefined };
  return { exists: () => true, id: docRef.id, data: () => data };
}

export async function setDoc(docRef: any, data: any, options?: any) {
  const insertData = { ...data, id: docRef.id };
  const { error } = await supabase.from(docRef.path).upsert(insertData);
  if (error) throw error;
}

export async function updateDoc(docRef: any, data: any) {
  const { error } = await supabase.from(docRef.path).update(data).eq('id', docRef.id);
  if (error) throw error;
}

export async function addDoc(collectionRef: any, data: any) {
  const { data: inserted, error } = await supabase.from(collectionRef.path).insert([data]).select().single();
  if (error) throw error;
  return { id: inserted.id };
}

export async function deleteDoc(docRef: any) {
  const { error } = await supabase.from(docRef.path).delete().eq('id', docRef.id);
  if (error) throw error;
}

// Mock onSnapshot, it's not used in App.tsx but exported
export function onSnapshot(ref: any, callback: any) {
  console.warn("onSnapshot mock called");
  return () => {};
}

export function increment(n: number) {
  // Supposed to be a special value. Supabase has its own methods or RPCs to do increments.
  // For compatibility, we'll throw or mock. App.tsx doesn't use it.
  return n;
}

export function serverTimestamp() {
  return new Date().toISOString();
}

export const Timestamp = {
  fromDate: (date: Date) => date.toISOString()
};

export function writeBatch(db: any) {
  let ops: Array<{type: 'update' | 'delete', table: string, id: string, data?: any}> = [];
  return {
    update(docRef: any, data: any) {
      ops.push({ type: 'update', table: docRef.path, id: docRef.id, data });
    },
    delete(docRef: any) {
      ops.push({ type: 'delete', table: docRef.path, id: docRef.id });
    },
    async commit() {
      for (const op of ops) {
        if (op.type === 'update') {
          await supabase.from(op.table).update(op.data).eq('id', op.id);
        } else if (op.type === 'delete') {
          await supabase.from(op.table).delete().eq('id', op.id);
        }
      }
    }
  };
}
