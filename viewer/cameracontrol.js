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
        this.cameraSpeed = 1.3;

        this.flyModeKeys = {
            ArrowLeft: (pan) => {
                this.camera.pan([pan, 0.0, 0.0]);
            },
            ArrowRight: (pan) => {
                this.camera.pan([- pan, 0.0, 0.0]);
            },
            ArrowUp: (pan) => {
                this.camera.pan([0.0, 0.0, - pan]);
            },
            ArrowDown: (pan) => {
                this.camera.pan([0.0, 0.0, pan]);
            }
        };
        this.timers = {};
        this.repeat = 10;


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

        this.canvas.addEventListener("blur", this.canvasBlurHandler = (e) => {
            this.canvasBlur(e);
        });

        this.pointerLockSupported = 'pointerLockElement' in document ||
            'mozPointerLockElement' in document ||
            'webkitPointerLockElement' in document;
        this.pointerLockEnabled = false;

        /*
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
        }*/

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

    getCanvasRelativePosFromEvent(event, percentage) {

        if (!event) {
            console.log("TODO");
        } else {
            var rect = event.target.getBoundingClientRect();
            //Get the coordinates of the center of the canvas
            var centerx = (rect.left + rect.right) / 2;
            var centery = (rect.bottom + rect.top) / 2;
            //Get the mouse position in the canvas space, 0,0 being at the center of the canvas
            var distancex = event.pageX - centerx;
            var distancey = event.pageY - centery;
            //Compute the percentage of offset from to center to border
            //0 is at center, 100% is at the edge
            percentage[0] = distancex / (rect.right - centerx);
            percentage[1] = distancey / (rect.bottom - centery);
            //console.log(" Mouse is at ", percentage[0], "% in x and ", percentage[1], "% in y");
        }
        return percentage;
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
                case "Escape":
                    console.log("Touche Escape pressée");
                    this.dragMode = DRAG_ORBIT;
                    break;
                default:
                    break;
            }
            if ((e.key in this.flyModeKeys) && !(e.key in this.timers)) {
                this.timers[e.key] = null;
                this.flyModeKeys[e.key](this.getEyeLookDist() / 600 * this.cameraSpeed);
                if (this.repeat !== 0) {
                    this.timers[e.key] = window.setInterval(this.flyModeKeys[e.key], this.repeat, (this.getEyeLookDist() / 600) * this.cameraSpeed);
                }
            }
        } else if (state == "up") {
            if (e.key in this.timers) {
                if (this.timers[e.key] !== null)
                    clearInterval(this.timers[e.key]);
                delete this.timers[e.key];
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
                    if (xDelta !== 0) {
                        this.yaw = xDelta * this.mouseMouseFlyModeSensitivity * 2 * (Math.PI / 180);
                        this.camera.yaw(this.yaw);
                    }
                    if (yDelta !== 0) {
                        this.pitch = yDelta * this.mouseMouseFlyModeSensitivity * 2 * (Math.PI / 180);
                        if (this.pitch > 89.0)
                            this.pitch = 89.0;
                        if (this.pitch < -89.0)
                            this.pitch = -89.0;

                        this.camera.pitch(this.pitch);
                    }
                }
            }
        }

        if (this.dragMode == FLY_MODE) {
            /*if (this.pointerLockEnabled == true) {

                this.yaw = -e.movementX * this.mouseMouseFlyModeSensitivity * (Math.PI / 180);
                this.camera.yaw(this.yaw);
                this.pitch = -e.movementY * this.mouseMouseFlyModeSensitivity * (Math.PI / 180);
                this.camera.pitch(this.pitch);
                console.log("Pointerlock Mouse Move")

            } */
            console.log("Regular Mouse Move")

            this.getCanvasPosFromEvent(e, this.mousePos);

            //Récupération en pourcentage de la position du curseur du centre vers les bors du Canvas
            this.getCanvasRelativePosFromEvent(e, this.mousePercentage);

            //Activation/Désactivaiton de la rotation horizontale de la caméra lorsque le curseur est au bords gauche ou droite
            Math.abs(this.mousePercentage[0]) < this.canvasMouseBorderTolerance ?
                this.clearMouseBorderInterval("Yaw") : this.mouseBorderChange(this.mousePercentage[0], "Yaw");

            //Activation/Désactivaiton de la rotation horizontale de la caméra lorsque le curseur  est au bords haut ou bas
            Math.abs(this.mousePercentage[1]) < this.canvasMouseBorderTolerance ?
                this.clearMouseBorderInterval("Pitch") : this.mouseBorderChange(this.mousePercentage[1], "Pitch");

            //Rotation standard de la caméra lorsque le curseur se trouve dans le canvas et hors des bords
            if ((Math.abs(this.mousePercentage[0]) < this.canvasMouseBorderTolerance) &&
                (Math.abs(this.mousePercentage[1]) < this.canvasMouseBorderTolerance)) {
                //if ((this.lastMouseMoveEventSample - this.viewer.timeStamp) < this.viewer.deltaTime)
                //return;

                //this.lastMouseMoveEventSample = this.viewer.timeStamp;


                //Interpolation produisant une vitesse --> effet d'ease in lorsqu'on quitte un bord et revient dans le canvas
                //Rotation plus jumpy sans
                if (this.mouseWasAtEdges == true) {
                    if (this.smoothstepIt < this.smoothstepSteps) {
                        this.interpolationFactor = 1 * (this.smoothstepC(this.smoothstepIt / this.smoothstepSteps))
                        console.log("MouseFlyModeSensitivity interpolated by factor ", this.interpolationFactor);
                        this.smoothstepIt++;
                    } else if (this.smoothstepIt >= this.smoothstepSteps) {
                        this.smoothstepIt = 0;
                        this.mouseWasAtEdges = false;
                    }

                }

                //Désactive le calcul de la rotation de la caméra lorsque le fly mode est activé et que le curseur revient sur le canvas
                //Cas non encontré avec la fonction du grand écran donc non pris en compte
                if (this.firstFlyMouse) // this bool variable is initially set to true
                {
                    this.lastX = this.mousePos[0];
                    this.lastY = this.mousePos[1];
                    this.firstFlyMouse = false;
                }


                //Calcul des deltas de déplacement du curseur
                var x = this.mousePos[0];
                var y = this.mousePos[1];
                var xDelta = (x - this.lastX);
                var yDelta = (y - this.lastY);
                this.lastX = x;
                this.lastY = y;
                let f = 0.035;

                //Conversions en angles des deltas et applications à la rotation de la caméra
                if (xDelta !== 0) {
                    this.yaw = -xDelta * this.mouseMouseFlyModeSensitivity * (Math.PI / 180);
                    this.camera.yaw(this.yaw * ((!!this.mouseWasAtEdges) ? this.interpolationFactor : 1));
                }
                if (yDelta !== 0) {
                    this.pitch = -yDelta * this.mouseMouseFlyModeSensitivity * (Math.PI / 180);
                    if (this.pitch > 89.0)
                        this.pitch = 89.0;
                    if (this.pitch < -89.0)
                        this.pitch = -89.0;

                    this.camera.pitch(this.pitch * ((!!this.mouseWasAtEdges) ? this.interpolationFactor : 1));
                }
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

    //Désactivation de la rotation automatique du au curseur traversant les edges jusqu'au reste de l'interface
    //Cas invalidé par la fonctionnalité grand écran
    canvasBlur(e) {
        for (key in this.timers)
            //if (timers[key] !== null)
            //clearInterval(timers[key]);
            this.timers = {};
    }

    getEyeLookDist() {
        var vec = vec3.create();
        return vec3.length(vec3.subtract(vec, this.viewer.camera.target, this.viewer.camera.eye));
    }

    //Activation/désactivation du mode de caméra subjective
    toggleFlyMode(bool) {
        if (bool) {
            this.dragMode = FLY_MODE;
            this.firstFlyMouse = true;
            //this.canvas.requestPointerLock();
        } else {
            this.dragMode = DRAG_ORBIT;
        }
    }

    //Mode de rotation de la caméra suivant le PointerLock
    //Le curseur disparait et la caméra bouge en fonction des déplacements de la souris non limités au canvas
    //Désactivé until further notice car la visibilité du curseur est requise pour la sélection
    /*
    pointerLockChange() {
        var pointerLockElement = document.pointerLockElement ||
            document.mozPointerLockElement ||
            document.webkitPointerLockElement;


        if (!!pointerLockElement) {
            // pointeur verrouillé
            if (pointerLockElement === this.canvas) {
                console.log('The pointer lock status is now locked on the Canvas');
                this.pointerLockEnabled = true;
            }


        } else {
            // pointeur non verrouillé
            console.log('The pointer lock status is now unlocked');
            //DRAG_MODE back to regular
            this.dragMode = DRAG_ORBIT;
            this.pointerLockEnabled = false;
            //document.removeEventListener("mousemove", updatePosition, false);
        }
    }*/

    //Activation de la rotation de la caméra et mise en place d'une rotation répétée
    mouseBorderChange(percentage, rotation) {
        if (Math.abs(percentage) > this.canvasMouseBorderTolerance) {
            this.mouseWasAtEdges = true;
            if ((rotation in this.rotateFromMouseAtBorder) && !(rotation in this.timersMouse)) {
                this.timersMouse[rotation] = null;
                this.rotateFromMouseAtBorder[rotation](
                    this.mouseFlyModeBorderSensitivity * percentage
                );
                if (this.repeatMouse !== 0) {
                    this.timersMouse[rotation] = window.setInterval(
                        this.rotateFromMouseAtBorder[rotation],
                        this.repeatMouse, (this.mouseFlyModeBorderSensitivity * percentage));
                }
            }
        }
    }

    //Désactivation de la répétion de la rotation
    clearMouseBorderInterval(rotation) {
        if (rotation in this.timersMouse) {
            if (this.timersMouse[rotation] !== null)
                clearInterval(this.timersMouse[rotation]);
            delete this.timersMouse[rotation];
        }
    }

    //Retour au mode de rotation en Orbite de la scène à la sortie du mode grand écran
    fullScreenChangeEvent(e) {
        var fullscreenElement = document.fullscreenElement || document.mozFullScreenElement || document.msFullscreenElement || document.webkitFullscreenElement;
        if (fullscreenElement) {
            console.log("Welcome to FullScreen");
        } else if (!fullscreenElement) {
            console.log("Exiting FullScreen Mode");
            this.dragMode = DRAG_ORBIT;
            this.clearMouseBorderInterval("Yaw");
            this.clearMouseBorderInterval("Pitch");
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

        if (this.pointerLockSupported) {
            document.removeEventListener('pointerlockchange', this.pointerLockChange);
            document.removeEventListener('mozpointerlockchange', this.pointerLockChange);
            document.removeEventListener('webkitpointerlockchange', this.pointerLockChange);
        }
        if (this.isFullscreenSupported == true) {
            document.addEventListener("fullscreenchange", this.fullScreenChangeEvent);
            document.addEventListener('mozfullscreenchange', this.fullScreenChangeEvent);
            document.addEventListener('MSFullscreenChange', this.fullScreenChangeEvent);
            document.addEventListener('webkitfullscreenchange', this.fullScreenChangeEvent);
        }
    }

    //Fonctions d'interpolation
    smoothstepS(x) {
        return ((x) * (x));
    }
    smoothstepC(x) {
        return ((x) * (x) * (x));
    }
}