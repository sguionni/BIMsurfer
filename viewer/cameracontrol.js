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
        this.mouseMouseFlyModeSensitivity = 2;
        this.mouseFlyModeBorderSensitivity = 40 * (Math.PI / 180);
        this.canvasPickTolerance = 4;

        this.canvas = viewer.canvas;
        this.camera = viewer.camera;

        this.mousePos = vec2.create();
        this.mousePercentage = vec2.create();
        this.mouseDownPos = vec2.create();
        this.over = false; // True when mouse over canvas
        this.lastX = 0; // Last canvas pos while dragging
        this.lastY = 0;
        this.yaw = 0;
        this.pitch = 0;
        this.cameraSpeed = 300;

        this.timestep = 1000 / 61;
        this.panValue = (this.getEyeLookDist() / 600) * this.cameraSpeed * this.timestep;

        this.flyModeKeys = {
            ArrowLeft: [false, 0, () => {
                this.camera.pan([this.panValue, 0.0, 0.0]);
            }],
            ArrowRight: [false, 0, () => {
                this.camera.pan([- this.panValue, 0.0, 0.0]);
            }],
            ArrowUp: [false, 0, () => {
                this.camera.pan([0.0, 0.0, - this.panValue]);
            }],
            ArrowDown: [false, 0, () => {
                this.camera.pan([0.0, 0.0, this.panValue]);
            }]
        };
        /*
        
                this.flyModeKeys = {
                    ArrowLeft: () => {
                        this.camera.pan([this.panValue, 0.0, 0.0]);
                    },
                    ArrowRight: () => {
                        this.camera.pan([- this.panValue, 0.0, 0.0]);
                    },
                    ArrowUp: () => {
                        this.camera.pan([0.0, 0.0, - this.panValue]);
                    },
                    ArrowDown: () => {
                        this.camera.pan([0.0, 0.0, this.panValue]);
                    }
                };
        this.timers = {};
        this.repeat = 1000 / 2;
        */

        this.mouseDown = false;
        this.firstFlyMouse = true;
        this.rotateFromMouseAtBorder = {
            Yaw: (angle) => {
                this.camera.yaw(-angle);
            },
            Pitch: (angle) => {
                this.camera.pitch(-angle);
            },

        }
        this.timersMouse = {};
        this.repeatMouse = 10;
        this.canvasMouseBorderTolerance = 0.995;
        this.lastMouseMoveEventSample = 0;
        this.mouseWasAtEdges = false;
        this.interpolationFactor = 0;
        this.smoothstepIt = 0;
        this.smoothstepSteps = 5;

        this.planSectionActivated = false;
        this.orbitInPlanSectionMode = false;
        this.formmerDragMode = DRAG_ORBIT;;
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

        this.isFullscreenSupported =
            (document.fullscreenEnabled ||
                document.webkitFullscreenEnabled ||
                ocument.mozFullScreenEnabled ||
                document.msFullscreenEnabled);

        if (this.isFullscreenSupported == true) {
            document.addEventListener("fullscreenchange", this.fullScreenChangeHandler = (e) => {
                this.fullScreenChangeEvent(e);
            });
            document.addEventListener('mozfullscreenchange', this.fullScreenChangeHandler = (e) => {
                this.fullScreenChangeEvent(e);
            });
            document.addEventListener('MSFullscreenChange', this.fullScreenChangeHandler = (e) => {
                this.fullScreenChangeEvent(e);
            });
            document.addEventListener('webkitfullscreenchange', this.fullScreenChangeHandler = (e) => {
                this.fullScreenChangeEvent(e);
            });
        }

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

        this.pointerLockSupported = 'pointerLockElement' in document ||
            'mozPointerLockElement' in document ||
            'webkitPointerLockElement' in document;
        this.pointerLockEnabled = false;


        //PointerLock Mode disabled unter further notice
        if (this.pointerLockSupported == true) {
            this.canvas.requestPointerLock = this.canvas.requestPointerLock ||
                this.canvas.mozRequestPointerLock ||
                this.canvas.webkitPointerLockElement;

            document.exitPointerLock = document.exitPointerLock ||
                document.mozExitPointerLock ||
                document.webkitExitPointerLock;

            document.addEventListener('pointerlockchange', this.pointerLockChangeHandler = (e) => {
                this.pointerLockChange()
            }, false);
            document.addEventListener('mozpointerlockchange', this.pointerLockChangeHandler = (e) => {
                this.pointerLockChange()
            }, false);
            document.addEventListener('webkitpointerlockchange', this.pointerLockChangeHandler = (e) => {
                this.pointerLockChange()
            }, false);
        }

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
        if (state == "down") {
            if ((e.key in this.flyModeKeys) && !(this.flyModeKeys[e.key][0])) {
                this.flyModeKeys[e.key][0] = true; //Peut devenir juste arrowleft = true
            }
            /*
            if ((e.key in this.flyModeKeys) && !(e.key in this.timers)) {
                this.timers[e.key] = null;
                this.flyModeKeys[e.key](this.getEyeLookDist() / 600 * this.cameraSpeed);
                if (this.repeat !== 0) {
                    this.timers[e.key] = window.setInterval(this.flyModeKeys[e.key], this.timestep, (this.getEyeLookDist() / 600) * this.cameraSpeed);
                }
            }*/
        } else if (state == "up") {
            if ((e.key in this.flyModeKeys) && (!!this.flyModeKeys[e.key][0])) {
                this.flyModeKeys[e.key][0] = false;
                this.flyModeKeys[e.key][1] = 0;
            }
            /*
            if (e.key in this.timers) {
                if (this.timers[e.key] !== null)
                    clearInterval(this.timers[e.key]);
                this.flyModeKeys[e.key][0] = false;
                this.flyModeKeys[e.key][1] = 0;
                delete this.timers[e.key];
                //Mettre le arroww a false
            }
            */
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
                if (this.dragMode == FLY_MODE) {
                    this.viewer.eventHandler.fire("full_screen_state_changed", true, true);

                    return;
                }
                else {
                    if (this.planSectionActivated) {
                        this.mouseDownTime = 0;
                        if (this.viewer.enableSectionPlane({ canvasPos: [this.lastX, this.lastY] })) {
                            this.orbitInPlanSectionMode = false;
                            this.dragMode = DRAG_SECTION;
                        } else {
                            this.viewer.disableSectionPlane();
                            this.orbitInPlanSectionMode = true;
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
                this.formmerDragMode = this.dragMode;
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
                if (this.dragMode == FLY_MODE) {
                    this.viewer.eventHandler.fire("full_screen_state_changed", true, false);
                }
                if (this.orbitInPlanSectionMode) {
                    this.orbitInPlanSectionMode = false;
                }

                if (this.planSectionActivated && !this.viewer.sectionPlaneIsDisabled) {
                    this.dragMode = DRAG_ORBIT;
                    this.planSectionActivated = false;
                    this.viewer.eventHandler.fire("plan_Section_Done");
                }
                if (dt < 500. && this.closeEnoughCanvas(this.mouseDownPos, this.mousePos)) {
                    if (this.dragMode == FLY_MODE) {
                        var rect = event.target.getBoundingClientRect();
                        this.mousePos = vec2.fromValues((rect.left + rect.right) / 2, (rect.bottom + rect.top) / 2)
                    }
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

        if (this.mouseDown || this.planSectionActivated) {
            this.getCanvasPosFromEvent(e, this.mousePos);
            if (this.dragMode == DRAG_SECTION) {
                this.viewer.moveSectionPlane({ canvasPos: this.mousePos });
            } else if (this.planSectionActivated && !this.orbitInPlanSectionMode) {
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
                }
            }
        }

        if (this.dragMode == FLY_MODE) {
            if (this.pointerLockEnabled == true) {

                this.yaw = -e.movementX * this.mouseMouseFlyModeSensitivity * (Math.PI / 180);
                this.camera.yaw(this.yaw);
                this.pitch = -e.movementY * this.mouseMouseFlyModeSensitivity * (Math.PI / 180);
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
            this.dragMode = this.formmerDragMode;
        }
    }

    //Désactivation de la rotation automatique du au curseur traversant les edges jusqu'au reste de l'interface
    //Cas invalidé par la fonctionnalité grand écran
    canvasBlur(e) {
        for (key in this.timers)
            if (timers[key] !== null)
                clearInterval(timers[key]);
        this.timers = {};
    }

    getEyeLookDist() {
        var vec = vec3.create();
        return vec3.length(vec3.subtract(vec, this.viewer.camera.target, this.viewer.camera.eye));
    }

    //Mode de rotation de la caméra suivant le PointerLock
    //Le curseur disparait et la caméra bouge en fonction des déplacements de la souris non limités au canvas
    //Désactivé until further notice car la visibilité du curseur est requise pour la sélection
    pointerLockChange() {
        var pointerLockElement = document.pointerLockElement ||
            document.mozPointerLockElement ||
            document.webkitPointerLockElement;


        if (!!pointerLockElement) {
            // pointeur verrouillé
            if (pointerLockElement === this.canvas) {
                this.pointerLockEnabled = true;
            }
        } else {
            // pointeur non verrouillé
            //DRAG_MODE back to regular
            this.dragMode = DRAG_ORBIT;
            this.pointerLockEnabled = false;
        }
    }

    //Retour au mode de rotation en Orbite de la scène à la sortie du mode grand écran
    fullScreenChangeEvent(e) {
        var fullscreenElement = document.fullscreenElement || document.mozFullScreenElement || document.msFullscreenElement || document.webkitFullscreenElement;
        if (fullscreenElement) {
            this.dragMode = FLY_MODE;
            this.viewer.eventHandler.fire("full_screen_state_changed", true, false);
            //Fonctionnalité du pointer lock désactivée
            this.canvas.requestPointerLock();
        } else if (!fullscreenElement) {
            this.dragMode = DRAG_ORBIT;
            this.viewer.eventHandler.fire("full_screen_state_changed", false, false);
        }
    }

    //Vérification de l'enfoncement d'une des touiches multidirectionnelle pour le déplacement
    updateCameraMovement() {
        var update = false;
        for (var key in this.flyModeKeys)
            update |= this.flyModeKeys[key][0];
        return update;
    }

    //Déplacement de la caméra dans la direction de la touche multidirectionelle active
    moveCamera(deltaTime) {
        if (!this.updateCameraMovement()) return;

        for (var key in this.flyModeKeys) {
            if (!!this.flyModeKeys[key][0]) {

                var delta = this.flyModeKeys[key][1];
                var numUpdateSteps = 0;
                delta += (deltaTime);

                while (delta >= this.timestep) {
                    this.flyModeKeys[key][2]();
                    delta -= this.timestep;
                    if (++numUpdateSteps >= 240) {
                        delta = 0;
                        break;
                    }
                }

            }
        }

    }

    //Activation / Désactivation du mode de section par plan
    togglePlanSection(active) {
        this.planSectionActivated = active;
        this.resetSectionPlan();
    }

    //Reset de la dernière section par plan
    resetSectionPlan() {
        this.viewer.disableSectionPlane();
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

        if (this.pointerLockSupported) {
            document.removeEventListener('pointerlockchange', this.pointerLockChange);
            document.removeEventListener('mozpointerlockchange', this.pointerLockChange);
            document.removeEventListener('webkitpointerlockchange', this.pointerLockChange);
        }

        if (this.isFullscreenSupported == true) {
            document.removeEventListener("fullscreenchange", this.fullScreenChangeEvent);
            document.removeEventListener('mozfullscreenchange', this.fullScreenChangeEvent);
            document.removeEventListener('MSFullscreenChange', this.fullScreenChangeEvent);
            document.removeEventListener('webkitfullscreenchange', this.fullScreenChangeEvent);
        }
    }
}