import * as mat4 from "./glmatrix/mat4.js";
import * as vec3 from "./glmatrix/vec3.js";
import * as vec2 from "./glmatrix/vec2.js";

export const DRAG_ORBIT = 0xfe01;
export const DRAG_PAN = 0xfe02;
export const DRAG_SECTION = 0xfe03;
export const FLY_MODE = 0xfe04;

/**
 Controls the camera with user input.
 */
export class CameraControl {

    constructor(viewer) {

        this.viewer = viewer;

        this.mousePanSensitivity = 0.5;
        this.mouseOrbitSensitivity = 0.5;
        this.canvasPickTolerance = 4;

        this.canvas = viewer.canvas;
        this.camera = viewer.camera;

        this.mousePos = vec2.create();
        this.mouseDownPos = vec2.create();
        this.over = false; // True when mouse over canvas
        this.lastX = 0; // Last canvas pos while dragging
        this.lastY = 0;
        this.yaw = 0;
        this.pitch = 0;

        this.mouseDown = false;
        this.firstFlyMouse = true;

        this.dragMode = DRAG_ORBIT;

        this.canvas.oncontextmenu = (e) => {
            e.preventDefault();
        };

        document.addEventListener("keydown", this.keyDownHandler = (e) => {
            this.keyEvent(e, "down");
        });

        document.addEventListener("keyup", this.keyUpHandler = (e) => {
            this.keyEvent(e, "up");
        });

        this.canvas.addEventListener("mousedown", this.canvasMouseDownHandler = (e) => {
            this.canvasMouseDown(e);
        });

        this.canvas.addEventListener("mouseup", this.canvasMouseUpHandler = (e) => {
            this.canvasMouseUp(e);
        });

        this.documentMouseUpHandler = (e) => {
            this.documentMouseUp(e);
        };
        document.addEventListener("mouseup", this.documentMouseUpHandler);

        this.canvas.addEventListener("mouseenter", this.canvasMouseEnterHandler = (e) => {
            this.over = true;
            e.preventDefault();
        });

        this.canvas.addEventListener("mouseleave", this.canvasMouseLeaveHandler = (e) => {
            this.over = false;
            e.preventDefault();
        });

        this.canvas.addEventListener("mousemove", this.canvasMouseMoveHandler = (e) => {
            this.canvasMouseMove(e);
        });

        this.canvas.addEventListener("wheel", this.canvasMouseWheelHandler = (e) => {
            this.canvasWheel(e);
        });
    }

    /**
     * @private
     */
    getCanvasPosFromEvent(event, canvasPos) {
        if (!event) {
            event = window.event;
            canvasPos[0] = event.x;
            canvasPos[1] = event.y;
        } else {
            //            var element = event.target;
            var totalOffsetLeft = 0;
            var totalOffsetTop = 0;
            //            while (element.offsetParent) {
            //                totalOffsetLeft += element.offsetLeft;
            //                totalOffsetTop += element.offsetTop;
            //                element = element.offsetParent;
            //            }

            var rect = event.target.getBoundingClientRect();
            totalOffsetLeft = rect.left;
            totalOffsetTop = rect.top;
            canvasPos[0] = event.pageX - totalOffsetLeft;
            canvasPos[1] = event.pageY - totalOffsetTop;
        }
        return canvasPos;
    }

    /**
     * @private
     */
    getZoomRate() {
        var modelBounds = this.viewer.modelBounds;
        if (modelBounds) {
            var xsize = modelBounds[3] - modelBounds[0];
            var ysize = modelBounds[4] - modelBounds[1];
            var zsize = modelBounds[5] - modelBounds[2];
            var max = (xsize > ysize ? xsize : ysize);
            max = (zsize > max ? zsize : max);
            return max / 20;
        } else {
            return 1;
        }
    }
    keyEvent(e, state) {
        //this.viewer.deltaTime;
        //var cameraSpeed = 100 * this.viewer.deltaTime;
        if (state == "down") {
            var cameraSpeed = 2.5;
            switch (e.key) {
                case "Control":
                    if (state === "down") {
                        if (this.viewer.sectionPlaneIsDisabled) {
                            this.viewer.positionSectionPlaneWidget({ canvasPos: [this.lastX, this.lastY] });
                        }
                    } else {
                        this.viewer.removeSectionPlaneWidget();
                    }
                    break;

                case "ArrowLeft":
                    // Left pressed
                    var f = this.getEyeLookDist() / 600;
                    this.camera.pan([cameraSpeed * f, 0.0, 0.0]);
                    break;
                case "ArrowRight":
                    // Right pressed
                    var f = this.getEyeLookDist() / 600;
                    this.camera.pan([-(cameraSpeed * f), 0.0, 0.0]);
                    break;
                case "ArrowUp":
                    // Up pressed
                    var f = this.getEyeLookDist() / 600;
                    this.camera.pan([0.0, 0.0, - (cameraSpeed * f)]);
                    break;
                case "ArrowDown":
                    // Down pressed
                    var f = this.getEyeLookDist() / 600;
                    this.camera.pan([0.0, 0.0, (cameraSpeed * f)]);
                    break;
                case "q":
                    /*if (this.dragMode !== FLY_MODE) {
                        this.dragMode = FLY_MODE;
                        this.firstFlyMouse = true;
                        console.log("Welcome to the fly mode");
                    } else {
                        console.log("Exiting the fly mode");
                        this.dragMode = DRAG_ORBIT;
                    }*/
                    break;
                default:
                    break;
            }
        }
        e.preventDefault();

    }

    /**
     * @private
     */
    canvasMouseDown(e) {
        this.getCanvasPosFromEvent(e, this.mousePos);

        this.lastX = this.mousePos[0];
        this.lastY = this.mousePos[1];

        this.mouseDown = true;
        this.mouseDownTime = e.timeStamp;
        this.mouseDownPos.set(this.mousePos);

        switch (e.which) {
            case 1:
                if (this.dragMode == FLY_MODE) return;
                else {
                    if (e.ctrlKey) {
                        this.mouseDownTime = 0;
                        if (this.viewer.enableSectionPlane({ canvasPos: [this.lastX, this.lastY] })) {
                            this.dragMode = DRAG_SECTION;
                        } else if (!this.viewer.sectionPlaneIsDisabled) {
                            this.viewer.disableSectionPlane();
                            this.dragMode = DRAG_ORBIT;
                        }
                        this.viewer.removeSectionPlaneWidget();
                    } else {
                        this.dragMode = DRAG_ORBIT;
                        let picked = this.viewer.pick({ canvasPos: [this.lastX, this.lastY], select: false });
                        if (picked && picked.coordinates && picked.object && this.viewer.getSelected().length > 0) {

                            this.viewer.camera.center = picked.coordinates;

                        } else {
                            this.viewer.camera.center = vec3.create();
                        }
                    }
                }
                break;
            case 2:
                this.dragMode = DRAG_PAN;
                break;
            default:
                break;
        }
        this.over = true;
        if (this.dragMode == DRAG_PAN || e.shiftKey) {
            e.preventDefault();
        }
    }

    /**
     * @private
     */
    canvasMouseUp(e) {

        this.camera.orbitting = false;
        this.viewer.overlay.update();
        this.getCanvasPosFromEvent(e, this.mousePos);

        let dt = e.timeStamp - this.mouseDownTime;
        this.mouseDown = false;

        switch (e.which) {
            case 1:
                if (dt < 500. && this.closeEnoughCanvas(this.mouseDownPos, this.mousePos)) {
                    var viewObject = this.viewer.pick({
                        canvasPos: this.mousePos,
                        shiftKey: e.shiftKey
                    });
                    if (viewObject && viewObject.object) {
                        console.log("Picked", viewObject.object);
                    }
                    this.viewer.drawScene();
                }
                break;
        }
        e.preventDefault();
    }

    /**
     * @private
     */
    canvasWheel(e) {
        this.getCanvasPosFromEvent(e, this.mousePos);
        var delta = Math.max(-1, Math.min(1, -e.deltaY * 40));
        if (delta === 0) {
            return;
        }
        var d = delta / Math.abs(delta);
        var zoom = -d * this.getZoomRate() * this.mousePanSensitivity;
        this.camera.zoom(zoom, this.mousePos);
        e.preventDefault();
    }

    /**
     * @private
     */
    closeEnoughCanvas(p, q) {
        return p[0] >= (q[0] - this.canvasPickTolerance) &&
            p[0] <= (q[0] + this.canvasPickTolerance) &&
            p[1] >= (q[1] - this.canvasPickTolerance) &&
            p[1] <= (q[1] + this.canvasPickTolerance);
    }

    /**
     * @private
     */
    canvasMouseMove(e) {
        if (!this.over) {
            return;
        }
        if (this.mouseDown || e.ctrlKey) {
            this.getCanvasPosFromEvent(e, this.mousePos);
            if (this.dragMode == DRAG_SECTION) {
                this.viewer.moveSectionPlane({ canvasPos: this.mousePos });
            } else if (e.ctrlKey) {
                this.viewer.positionSectionPlaneWidget({ canvasPos: this.mousePos });
            } else {
                var x = this.mousePos[0];
                var y = this.mousePos[1];
                var xDelta = (x - this.lastX);
                var yDelta = (y - this.lastY);
                this.lastX = x;
                this.lastY = y;
                if (this.dragMode == DRAG_ORBIT) {
                    let f = 0.5;
                    if (xDelta !== 0) {
                        this.camera.orbitYaw(-xDelta * this.mouseOrbitSensitivity * f);
                    }
                    if (yDelta !== 0) {
                        this.camera.orbitPitch(yDelta * this.mouseOrbitSensitivity * f);
                    }
                    this.camera.orbitting = true;
                } else if (this.dragMode == DRAG_PAN) {
                    var f = this.getEyeLookDist() / 600;
                    this.camera.pan([xDelta * f, yDelta * this.mousePanSensitivity * f, 0.0]);
                } else if (this.dragMode == FLY_MODE) {
                    let f = 0.02;
                    if (xDelta !== 0) {
                        this.yaw = -xDelta * this.mouseOrbitSensitivity * f;
                        this.camera.yaw(-this.yaw);
                    }
                    if (yDelta !== 0) {
                        this.pitch = -yDelta * this.mouseOrbitSensitivity * f;
                        if (this.pitch > 89.0)
                            this.pitch = 89.0;
                        if (this.pitch < -89.0)
                            this.pitch = -89.0;

                        this.camera.pitch(-this.pitch);
                    }
                    /*
                                        let f = 0.5;
                                        if (xDelta !== 0) {
                                            this.yaw = -xDelta * this.mouseOrbitSensitivity * f;
                                            this.camera.yaw(this.yaw);
                                        }
                                        if (yDelta !== 0) {
                                            this.pitch = -yDelta * this.mouseOrbitSensitivity * f;
                                            if (this.pitch > 89.0)
                                                this.pitch = 89.0;
                                            if (this.pitch < -89.0)
                                                this.pitch = -89.0;
                    
                                            this.camera.pitch(this.pitch);
                                        }*/
                }
            }
        }

        if (this.dragMode == FLY_MODE) {
            this.getCanvasPosFromEvent(e, this.mousePos);

            if (this.firstFlyMouse) // this bool variable is initially set to true
            {
                this.lastX = this.mousePos[0];
                this.lastY = this.mousePos[1];
                this.firstFlyMouse = false;
            }

            var x = this.mousePos[0];
            var y = this.mousePos[1];
            var xDelta = (x - this.lastX);
            var yDelta = (y - this.lastY);
            this.lastX = x;
            this.lastY = y;
            let f = 0.035;
            if (xDelta !== 0) {
                this.yaw = -xDelta * this.mouseOrbitSensitivity * f;
                this.camera.yaw(this.yaw);
            }
            if (yDelta !== 0) {
                this.pitch = -yDelta * this.mouseOrbitSensitivity * f;
                if (this.pitch > 89.0)
                    this.pitch = 89.0;
                if (this.pitch < -89.0)
                    this.pitch = -89.0;

                this.camera.pitch(this.pitch);
            }
        }

        e.preventDefault();
    }

    /**
     * @private
     */
    documentMouseUp(e) {
        this.mouseDown = false;
        // Potential end-of-pan
        if (this.dragMode == DRAG_PAN) {
            this.camera.updateLowVolumeListeners();
        }
        this.dragMode = (this.dragMode == FLY_MODE) ? FLY_MODE : DRAG_ORBIT;
    }

    getEyeLookDist() {
        var vec = vec3.create();
        return vec3.length(vec3.subtract(vec, this.viewer.camera.target, this.viewer.camera.eye));
    }

    toggleFlyMode(bool) {
        if (bool) {
            this.dragMode = FLY_MODE;
            this.firstFlyMouse = true;
        } else {
            this.dragMode = DRAG_ORBIT;
        }
    }

    /**
     * @private
     */
    cleanup() {
        var canvas = this.canvas;
        document.removeEventListener("mouseup", this.documentMouseUpHandler);
        canvas.removeEventListener("mousedown", this.canvasMouseDownHandler);
        canvas.removeEventListener("mouseup", this.canvasMouseUpHandler);
        document.removeEventListener("mouseup", this.documentMouseUpHandler);
        canvas.removeEventListener("mouseenter", this.canvasMouseEnterHandler);
        canvas.removeEventListener("mouseleave", this.canvasMouseLeaveHandler);
        canvas.removeEventListener("mousemove", this.canvasMouseMoveHandler);
        canvas.removeEventListener("wheel", this.canvasMouseWheelHandler);
    }
}