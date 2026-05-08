import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

// ---------- SETUP ----------
const wrapper = document.getElementById('canvas-wraper');
const canvas = document.getElementById('canvas');
canvas.width = wrapper.clientWidth;
canvas.height = wrapper.clientHeight;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, canvas.width / canvas.height, 0.1, 100);
camera.position.set(2, 1.5, 3);
camera.lookAt(0, 0, 0);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.1;
controls.autoRotate = false;
controls.autoRotateSpeed = 2.0;

// Lights
scene.add(new THREE.AmbientLight(0x404066));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(1, 2, 1);
scene.add(dirLight);
const dirLight2 = new THREE.DirectionalLight(0xccddff, 0.6);
dirLight2.position.set(-1, -1, -0.5);
scene.add(dirLight2);

let model = null;

// ---------- FILE LOADING ----------
function autoFit() {
    if (!model) return;
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim === 0) return;
    const dist = maxDim * 1.5;
    camera.position.copy(center.clone().add(new THREE.Vector3(dist * 0.8, dist * 0.6, dist)));
    controls.target.copy(center);
    controls.update();
}

function loadModel(file) {
    const url = URL.createObjectURL(file);
    new OBJLoader().load(url, (obj) => {
        if (model) scene.remove(model);
        model = obj;

        // Center & scale
        const box = new THREE.Box3().setFromObject(obj);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        obj.position.sub(center);
        if (maxDim > 0) obj.scale.setScalar(1.5 / maxDim);

        scene.add(obj);
        document.body.classList.add('model-loaded');
        URL.revokeObjectURL(url);
        autoFit();
    });
}

const fileInput = document.getElementById('file-input');
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        loadModel(file);
        // Reset so the same file can be loaded again
        fileInput.value = '';
    }
});

document.getElementById('drop-message').addEventListener('click', () => {
    fileInput.click();
});

// Drag & drop
const overlay = document.getElementById('canvas-overlay');
['dragenter', 'dragover'].forEach(ev => {
    overlay.addEventListener(ev, (e) => {
        e.preventDefault();
        e.stopPropagation();
        overlay.style.background = 'rgba(100,120,160,0.3)';
    });
});
['dragleave', 'drop'].forEach(ev => {
    overlay.addEventListener(ev, (e) => {
        e.preventDefault();
        e.stopPropagation();
        overlay.style.background = '';
    });
});
overlay.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files[0];
    if (file && file.name.toLowerCase().endsWith('.obj')) {
        loadModel(file);
        // No need to reset fileInput here
    }
});

// ---------- TOOLBAR BUTTONS ----------
// Open
document.getElementById('btn-open').addEventListener('click', () => fileInput.click());

// Screenshot
let bgEnabled = false;
let bgColor = '#00ff00';
const btnBg = document.getElementById('btn-bg');

document.getElementById('btn-screenshot').addEventListener('click', async () => {
    if (bgEnabled) {
        renderer.render(scene, camera);
        const dataURL = canvas.toDataURL('image/png');
        downloadDataURL(dataURL, 'model-screenshot.png');
    } else {
        // Hide UI
        const header = document.getElementById('header');
        const optionsBar = document.getElementById('canvas-options');
        const dropMsg = document.getElementById('drop-message');
        const handle = document.getElementById('resize-handle');
        const origDisplay = {
            header: header.style.display,
            options: optionsBar.style.display,
            drop: dropMsg.style.display,
            handle: handle.style.display
        };
        header.style.display = 'none';
        optionsBar.style.display = 'none';
        dropMsg.style.display = 'none';
        handle.style.display = 'none';

        // Temporarily apply body pattern to wrapper
        const bodyStyle = getComputedStyle(document.body);
        const origWrapperBg = wrapper.style.backgroundImage;
        const origWrapperBgColor = wrapper.style.backgroundColor;
        const origWrapperBgSize = wrapper.style.backgroundSize;
        const origWrapperBgPos = wrapper.style.backgroundPosition;
        const origWrapperBackdrop = wrapper.style.backdropFilter;

        wrapper.style.backgroundImage = bodyStyle.backgroundImage;
        wrapper.style.backgroundColor = bodyStyle.backgroundColor;
        wrapper.style.backgroundSize = bodyStyle.backgroundSize;
        wrapper.style.backgroundPosition = bodyStyle.backgroundPosition;
        wrapper.style.backdropFilter = 'none';

        try {
            renderer.render(scene, camera);
            const canvasShot = await html2canvas(wrapper, {
                backgroundColor: null,
                allowTaint: true,
                useCORS: true
            });
            const dataURL = canvasShot.toDataURL('image/png');
            downloadDataURL(dataURL, 'model-screenshot.png');
        } catch (err) {
            alert('Screenshot failed. Try enabling a solid background.');
        } finally {
            header.style.display = origDisplay.header;
            optionsBar.style.display = origDisplay.options;
            dropMsg.style.display = origDisplay.drop;
            handle.style.display = origDisplay.handle;
            // Restore wrapper backgrounds
            wrapper.style.backgroundImage = origWrapperBg;
            wrapper.style.backgroundColor = origWrapperBgColor;
            wrapper.style.backgroundSize = origWrapperBgSize;
            wrapper.style.backgroundPosition = origWrapperBgPos;
            wrapper.style.backdropFilter = origWrapperBackdrop;
        }
    }
});

function downloadDataURL(dataURL, filename) {
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataURL;
    link.click();
}

// Clear model
document.getElementById('btn-clear').addEventListener('click', () => {
    if (model) {
        scene.remove(model);
        model = null;
        document.body.classList.remove('model-loaded');
        document.getElementById('btn-wire').classList.remove('active');
    }
});

// Auto-rotate toggle
const btnRotate = document.getElementById('btn-rotate');
btnRotate.addEventListener('click', () => {
    controls.autoRotate = !controls.autoRotate;
    btnRotate.classList.toggle('active', controls.autoRotate);
});

// Speed slider & direction
const speedSlider = document.getElementById('rotate-speed');
const btnLeft = document.getElementById('rotate-left');
const btnRight = document.getElementById('rotate-right');
speedSlider.addEventListener('input', (e) => {
    controls.autoRotateSpeed = parseFloat(e.target.value);
});
btnLeft.addEventListener('click', () => controls.autoRotateSpeed = -Math.abs(controls.autoRotateSpeed));
btnRight.addEventListener('click', () => controls.autoRotateSpeed = Math.abs(controls.autoRotateSpeed));

// Fit view
document.getElementById('btn-zoom').addEventListener('click', autoFit);

// Wireframe toggle
const btnWire = document.getElementById('btn-wire');
btnWire.addEventListener('click', () => {
    if (!model) return;
    model.traverse((child) => {
        if (child.isMesh && child.material) {
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach(mat => {
                mat.wireframe = !mat.wireframe;
                if (mat.wireframe) {
                    mat.color = new THREE.Color(0xffffff);
                    mat.emissive = new THREE.Color(0x333333);
                } else {
                    mat.emissive = new THREE.Color(0x000000);
                }
            });
        }
    });
    btnWire.classList.toggle('active');
});

// ---------- BACKGROUND COLOR ----------
btnBg.addEventListener('click', () => {
    bgEnabled = !bgEnabled;
    btnBg.classList.toggle('active', bgEnabled);
    if (bgEnabled) {
        renderer.setClearColor(new THREE.Color(bgColor), 1);
    } else {
        renderer.setClearColor(0x000000, 0);
    }
});

document.querySelectorAll('.color-preset').forEach(preset => {
    preset.addEventListener('click', (e) => {
        const color = e.target.dataset.color;
        bgColor = color;
        document.getElementById('bg-custom').value = color;
        if (bgEnabled) renderer.setClearColor(new THREE.Color(color), 1);
    });
});
document.getElementById('bg-custom').addEventListener('input', (e) => {
    bgColor = e.target.value;
    if (bgEnabled) renderer.setClearColor(new THREE.Color(bgColor), 1);
});

// ---------- WASD + EQ MOVEMENT ----------
const keyState = { w: false, a: false, s: false, d: false, e: false, q: false };
const moveSpeed = 1.8;
window.addEventListener('keydown', (e) => {
    switch (e.key.toLowerCase()) {
        case 'w': keyState.w = true; break;
        case 'a': keyState.a = true; break;
        case 's': keyState.s = true; break;
        case 'd': keyState.d = true; break;
        case 'e': keyState.e = true; break;
        case 'q': keyState.q = true; break;
    }
});
window.addEventListener('keyup', (e) => {
    switch (e.key.toLowerCase()) {
        case 'w': keyState.w = false; break;
        case 'a': keyState.a = false; break;
        case 's': keyState.s = false; break;
        case 'd': keyState.d = false; break;
        case 'e': keyState.e = false; break;
        case 'q': keyState.q = false; break;
    }
});

// ---------- FREE‑FORM RESIZE (2x movement) ----------
const resizeHandle = document.getElementById('resize-handle');
let resizing = false;
let startX, startY, startWidth, startHeight;

resizeHandle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    resizing = true;
    startX = e.clientX;
    startY = e.clientY;
    startWidth = wrapper.offsetWidth;
    startHeight = wrapper.offsetHeight;
});

window.addEventListener('mousemove', (e) => {
    if (!resizing) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const newWidth = Math.max(300, startWidth + dx * 2);
    const newHeight = Math.max(300, startHeight + dy * 2);
    wrapper.style.width = newWidth + 'px';
    wrapper.style.height = newHeight + 'px';
    wrapper.style.aspectRatio = 'auto';  // break the 1/1 lock

    canvas.width = newWidth;
    canvas.height = newHeight;
    camera.aspect = newWidth / newHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(newWidth, newHeight);
});

window.addEventListener('mouseup', () => {
    resizing = false;
});

// ---------- RENDER LOOP ----------
const clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.1);

    // WASD movement
    if (keyState.w || keyState.a || keyState.s || keyState.d || keyState.e || keyState.q) {
        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();
        const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();

        const delta = new THREE.Vector3();
        if (keyState.w) delta.add(forward);
        if (keyState.s) delta.sub(forward);
        if (keyState.d) delta.add(right);
        if (keyState.a) delta.sub(right);
        if (keyState.e) delta.add(new THREE.Vector3(0, 1, 0));
        if (keyState.q) delta.sub(new THREE.Vector3(0, 1, 0));

        delta.normalize().multiplyScalar(moveSpeed * dt);
        camera.position.add(delta);
        controls.target.add(delta);
    }

    controls.update();
    renderer.render(scene, camera);
}
animate();

// Window resize (revert to responsive square if not manually resized)
window.addEventListener('resize', () => {
    if (!resizing) {
        wrapper.style.width = '80vw';
        wrapper.style.height = 'auto';
        wrapper.style.aspectRatio = '1 / 1';
        canvas.width = wrapper.clientWidth;
        canvas.height = wrapper.clientHeight;
        camera.aspect = canvas.width / canvas.height;
        camera.updateProjectionMatrix();
        renderer.setSize(canvas.width, canvas.height);
    }
});