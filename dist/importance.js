// Shared legacy migration and numeric rating normalization.
export function normalizeImportance(value){
 if(Number.isInteger(value)&&value>=0&&value<=5)return value;
 const legacy={low:0,normal:3,high:5};
 return Object.hasOwn(legacy,value)?legacy[value]:3;
}
