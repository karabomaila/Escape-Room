import { KeyDisplay, W } from './utils';
import { CharacterControls } from './characterControls';
import * as THREE from 'three'
import { CameraHelper, ZeroCurvatureEnding } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as CANNON from 'cannon-es'
import { World } from 'cannon-es';
import { mode } from '../webpack.config';
// import CannonHelper from './scripts/CannonHelper'
// SCENE
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa8def0);

// CAMERA
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, .01, 1000000);
camera.position.y = 5;
camera.position.z = 5;
camera.position.x = 0;

// RENDERER
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true

// CONTROLS
const orbitControls = new OrbitControls(camera, renderer.domElement);
orbitControls.enableDamping = true
orbitControls.minDistance = 700
orbitControls.maxDistance = 1000000000
orbitControls.enablePan = false
orbitControls.maxPolarAngle = Math.PI / 2 - 0.05
orbitControls.update();

// LIGHTS
light()

// FLOOR
// generateFloor()

// Physics World

const world = new CANNON.World({
    gravity: new CANNON.Vec3(0, -900.81, 0)
});

world.broadphase = new CANNON.NaiveBroadphase()
world.broadphase.useBoundingBoxes = true

// ROOM
var myRoom: THREE.Group

new GLTFLoader().load("RoomToBeEscaped/scene.gltf", function (gltf) {
    myRoom = gltf.scene
    scene.add(myRoom)
    myRoom.castShadow = true
    myRoom.receiveShadow = true
})

var myRoom2: THREE.Group

new GLTFLoader().load("RoomToBeEscaped/room2/scene.gltf", function (gltf) {
    myRoom2 = gltf.scene
    scene.add(myRoom2)
    myRoom2.scale.set(5, 5, 5)
    myRoom2.position.set(500, -1000, -4600)
    myRoom2.castShadow = true
    myRoom2.receiveShadow = true
})


// MODEL WITH ANIMATIONS
var model: THREE.Group
var characterControls: CharacterControls

new GLTFLoader().load('Characters/Soldier/Soldier.glb', function (gltf) {
    model = gltf.scene;
    model.traverse(function (object: any) {
        if (object.isMesh) object.castShadow = true;
    });
    scene.add(model);
    model.scale.set(150, 150, 150)
    model.position.z = -250
    model.castShadow = true
    model.receiveShadow = true

    const gltfAnimations: THREE.AnimationClip[] = gltf.animations;
    const mixer = new THREE.AnimationMixer(model);
    const animationsMap: Map<string, THREE.AnimationAction> = new Map()
    gltfAnimations.filter(a => a.name != 'TPose').forEach((a: THREE.AnimationClip) => {
        animationsMap.set(a.name, mixer.clipAction(a))
    })

    characterControls = new CharacterControls(model, mixer, animationsMap, orbitControls, camera, 'Idle')
});

const timeStep = 1 / 60;



// CONTROL KEYS
const keysPressed = {}
const keyDisplayQueue = new KeyDisplay();
document.addEventListener('keydown', (event) => {
    keyDisplayQueue.down(event.key)
    if (event.shiftKey && characterControls) {
        characterControls.switchRunToggle()
    } else {
        (keysPressed as any)[event.key.toLowerCase()] = true
    }
}, false);
document.addEventListener('keyup', (event) => {
    keyDisplayQueue.up(event.key);
    (keysPressed as any)[event.key.toLowerCase()] = false
}, false);

// ANIMATE
var start = 0
function animate() {
    world.step(timeStep);
    var direction: THREE.Vector3
    if (characterControls) {
        direction = characterControls.walkDirection
        direction.normalize()
    }

    var origin
    var intersects: THREE.Intersection[][][] = []

    // Checking for obstacles in front of the character
    var step = false;
    if (model) {
        origin = new THREE.Vector3(model.position.x, model.position.y + start, model.position.z)

        const downRaycaster = new THREE.Raycaster(
            origin,
            new THREE.Vector3(0, -1, 0),
            0,
            700000000000000
        )
        let downIntersects: THREE.Intersection[][] = []
        if (myRoom) {
            myRoom.traverse(function (object: any) {
                if (object.isMesh) {
                    let thisDownIntersect = downRaycaster.intersectObject(object)
                    if (thisDownIntersect.length !== 0) {
                        downIntersects.push(thisDownIntersect)
                    }
                }
            })
        }
        if (downIntersects.length !== 0) {
            let newYPosition = downIntersects[0][0].distance
            if (newYPosition > 27) {
                // console.log("distance = "+downIntersects[0][0].distance)
                // model.position.y = 0
                start = 0
                // modelBody.position.y = 0
            }

            
        }
        // const arrowHelper = new THREE.ArrowHelper(new THREE.Vector3(0, -1, 0), origin, 700000000000000, 0x0000ff);
        // scene.add(arrowHelper);
        let preIntersect = 0
        while (origin.y !== 260 + start) {
            const raycaster = new THREE.Raycaster(
                origin,
                direction,
                0,
                70
            )

            var thisRayIntersects: THREE.Intersection[][] = []
            if (myRoom) {
                myRoom.traverse(function (object: any) {
                    if (object.isMesh) {
                        let intersected = raycaster.intersectObject(object)
                        if (intersected.length !== 0) {
                            thisRayIntersects.push(intersected)
                        }
                    }
                })
            }

            if (thisRayIntersects.length !== 0 && thisRayIntersects.length < 55) {  preIntersect = origin.y  }

            if (thisRayIntersects.length !== 0) {   intersects.push(thisRayIntersects)  }

            // const arrowHelper = new THREE.ArrowHelper(direction, origin, 70, 0x0000ff);
            // scene.add(arrowHelper);

            if (thisRayIntersects.length === 0 && origin.y <= 55 && intersects.length !== 0) {
                model.position.y = preIntersect
                start = preIntersect
                step = true
                break;
            }
            origin.y += 5
        }
    }

    // Keeping the character and camera and the same position if there are obstacles
    if (model !== undefined && intersects.length !== 0 &&!step) {
        if (characterControls) {
            model.position.set( characterControls.modelPrePos.x, characterControls.modelPrePos.y, characterControls.modelPrePos.z)
            characterControls.camera.position.set(characterControls.camPrePos.x, characterControls.camPrePos.y, characterControls.camPrePos.z)
        }
    }

    if (characterControls) {
        characterControls.update(timeStep, keysPressed);
    }
    orbitControls.update()
    renderer.render(scene, camera);
}

document.body.appendChild(renderer.domElement);

// animate();
renderer.setAnimationLoop(animate)

// RESIZE HANDLER
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    keyDisplayQueue.updatePosition()
}
window.addEventListener('resize', onWindowResize);

function light() {
    scene.add(new THREE.AmbientLight(0xffffff, 0.7))

    const dirLight = new THREE.DirectionalLight(0xffffff, 1)
    dirLight.position.set(- 60, 100, - 10);
    dirLight.castShadow = true;
    dirLight.shadow.camera.top = 50;
    dirLight.shadow.camera.bottom = - 50;
    dirLight.shadow.camera.left = - 50;
    dirLight.shadow.camera.right = 50;
    dirLight.shadow.camera.near = 0.1;
    dirLight.shadow.camera.far = 200;
    dirLight.shadow.mapSize.width = 4096;
    dirLight.shadow.mapSize.height = 4096;
    scene.add(dirLight);
    // scene.add( new THREE.CameraHelper(dirLight.shadow.camera))
}