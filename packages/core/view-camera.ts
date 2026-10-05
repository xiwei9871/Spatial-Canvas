import { Matrix4, Quaternion } from 'three';
import type { CameraView } from '../protocol/context';
export function sourceCameraPose(view:Pick<CameraView,'position'|'quaternion'>,frame_id:string){
 const basis=new Matrix4().set(1,0,0,0,0,0,-1,0,0,1,0,0,0,0,0,1);
 const rotation=new Matrix4().makeRotationFromQuaternion(new Quaternion(...view.quaternion));
 const sourceRotation=basis.clone().multiply(rotation);
 return {position:[view.position[0],-view.position[2],view.position[1]] as [number,number,number],quaternion:new Quaternion().setFromRotationMatrix(sourceRotation).toArray() as [number,number,number,number],frame_id,unit:'meter' as const,up_axis:'Z' as const};
}
