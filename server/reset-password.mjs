import {DatabaseSync} from 'node:sqlite';
import {existsSync,readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {passwordHash} from './app.mjs';

// Server administrator recovery only. Read passwords from stdin, never arguments.
export function resetPassword(dbPath,username,password){
 if(!existsSync(dbPath))throw new Error('Library database not found. Start the multi-user server first.');
 const name=String(username||'').trim().toLowerCase();
 if(!/^[a-z0-9][a-z0-9_.-]{2,39}$/.test(name))throw new Error('Specify a valid account username.');
 const db=new DatabaseSync(dbPath);
 try{
  const user=db.prepare('SELECT id FROM users WHERE username=?').get(name);
  if(!user)throw new Error('Account not found.');
  const hash=passwordHash(password);
  db.exec('BEGIN IMMEDIATE');
  try{db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hash,user.id);db.prepare('DELETE FROM user_sessions WHERE user_id=?').run(user.id);db.exec('COMMIT')}catch(err){db.exec('ROLLBACK');throw err}
 }finally{db.close()}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{resetPassword(process.env.DB_PATH||'./.runtime/folio.sqlite',process.argv[2],readFileSync(0,'utf8').replace(/\r?\n$/,''));console.log('Password reset. All sessions for this account were signed out.')}catch(err){console.error(err.message);process.exitCode=1}
}
