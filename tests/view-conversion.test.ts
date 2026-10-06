import {expect,it} from 'vitest';
import {Matrix4,PerspectiveCamera,Quaternion,Vector3} from 'three';
import {sourceCameraPose} from '../packages/core/view-camera';
import {packet} from './context-data';
it('keeps camera local axes when transforming Y-up world to Blender Z-up',()=>{
 const view={...packet.view.data,position:packet.view.data.position as [number,number,number],quaternion:new Quaternion().setFromAxisAngle(new Vector3(0,1,0),.6).toArray() as [number,number,number,number]};
 const source=sourceCameraPose(view,'source');
 const q=new Quaternion(...view.quaternion),sq=new Quaternion(...source.quaternion);
 for(const local of [new Vector3(1,0,0),new Vector3(0,1,0),new Vector3(0,0,-1)]){
  const p=local.clone().applyQuaternion(q),expected=new Vector3(p.x,-p.z,p.y);
  expect(local.clone().applyQuaternion(sq).distanceTo(expected)).toBeLessThan(1e-8);
 }
 const camera=new PerspectiveCamera(view.fov_degrees,view.viewport.width/view.viewport.height,view.near,view.far);
 camera.position.fromArray(view.position);camera.quaternion.copy(q);camera.updateMatrixWorld();
 const p=new Vector3(0,0,-8).applyQuaternion(q).add(camera.position),ndc=p.clone().project(camera);
 camera.position.fromArray(source.position);camera.quaternion.copy(sq);camera.updateMatrixWorld();
 expect(p.clone().applyMatrix4(new Matrix4().set(1,0,0,0,0,0,-1,0,0,1,0,0,0,0,0,1)).project(camera).distanceTo(ndc)).toBeLessThan(1e-8);
});
