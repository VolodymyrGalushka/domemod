var glslify = require('glslify');

var canvas;
var gl;
var intervalID;

var cubeVerticesBuffer;
var cubeVerticesTextureCoordBuffer;
var cubeVerticesIndexBuffer;
var cubeVerticesIndexBuffer;

/* textures */
var sourceTexture;

var shaderProgram;
//attribute locations
var vertexPositionAttribute;
var textureCoordAttribute;
//uniform locations
var uSizeLoc,
    uSrcTexLoc,
    uShowGridLoc,
    uSrcTexProjTypeLoc;

var mediaContainer,
    mediaElement;

/*parameter*/
var params;

var screenWidth, screenHeight, showGrid = 0;

var currentURL;

var srcTexInfo = {
  shouldUpdate : false,
  type: undefined,
  //0 – equirectangular
  //1 - azimuthal 180°
  //2 - azimuthal 360 °
  projection_type: 0
};

window.onload = start;


//
// start
//
// Called when the canvas is created to get the ball rolling.
//
function start() {
  console.log("start called");
  // fitCanvas();
  // window.addEventListener('resize', fitCanvas, false);
  screenWidth = screen.width;
  screenHeight = screen.height;
  console.log("screen dimensions: ", screenWidth, "x", screenHeight);
  setupFileHandling();
  canvas = document.getElementById("glcanvas");

  setupParams();
  // loadDefaultImage('./assets/images/Equirectangular_projection_SW.jpg');
  initGUI();
  initWebGL(canvas);      // Initialize the GL context

  // Only continue if WebGL is available and working

  if (gl) {
    fitCanvas();
    gl.clearColor(0.0, 0.0, 0.0, 1.0);  // Clear to black, fully opaque
    /*
    gl.clearDepth(1.0);                 // Clear everything
    gl.enable(gl.DEPTH_TEST);           // Enable depth testing
    gl.depthFunc(gl.LEQUAL);            // Near things obscure far things
    */
    // Initialize the shaders; this is where all the lighting for the
    // vertices and so forth is established.

    initShaders();

    // Here's where we call the routine that builds all the objects
    // we'll be drawing.

    initBuffers();

    // Next, load and set up the textures we'll be using.

    initTextures();
    initInput();
    // activateVideoListeners(videoElement);
    initImage('./assets/images/World_Equirectangular.jpg');
  }
}

//see:
//http://webglfundamentals.org/webgl/lessons/webgl-resizing-the-canvas.html
//http://stackoverflow.com/questions/11819768/webgl-gl-viewport-change
//http://webglfundamentals.org/webgl/lessons/webgl-anti-patterns.html

function fitCanvas() {
  var width = gl.canvas.clientWidth;
  var height = gl.canvas.clientHeight;
  var pr = window.devicePixelRatio;
  //TODO!
  // pr = 1.0;
  if (gl.canvas.width != width || gl.canvas.height != height) {
     gl.canvas.width = width * pr;
     gl.canvas.height = height * pr;
     if (gl) {
         gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
     }
  }
}

//
// initWebGL
//
// Initialize WebGL, returning the GL context or null if
// WebGL isn't available or could not be initialized.
//
function initWebGL() {
  gl = null;

  try {
    gl = canvas.getContext("experimental-webgl");
  }
  catch(e) {
  }

  // If we don't have a GL context, give up now

  if (!gl) {
    alert("Unable to initialize WebGL. Your browser may not support it.");
  }
}

//
// initBuffers
//
// Initialize the buffers we'll need. For this demo, we just have
// one object -- a simple two-dimensional cube.
//
function initBuffers() {

  // Create a buffer for the cube's vertices.

  cubeVerticesBuffer = gl.createBuffer();

  // Select the cubeVerticesBuffer as the one to apply vertex
  // operations to from here out.

  gl.bindBuffer(gl.ARRAY_BUFFER, cubeVerticesBuffer);

  // Now create an array of vertices for the cube.

  var vertices = [
    // Front face
    -1.0, -1.0,  1.0,
     1.0, -1.0,  1.0,
     1.0,  1.0,  1.0,
    -1.0,  1.0,  1.0
  ];

  // Now pass the list of vertices into WebGL to build the shape. We
  // do this by creating a Float32Array from the JavaScript array,
  // then use it to fill the current vertex buffer.

  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

  cubeVerticesTextureCoordBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cubeVerticesTextureCoordBuffer);

  var textureCoordinates = [
    // Front
    0.0,  0.0,
    1.0,  0.0,
    1.0,  1.0,
    0.0,  1.0
  ];

  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoordinates),
                gl.STATIC_DRAW);

  // Build the element array buffer; this specifies the indices
  // into the vertex array for each face's vertices.

  cubeVerticesIndexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeVerticesIndexBuffer);

  // This array defines each face as two triangles, using the
  // indices into the vertex array to specify each triangle's
  // position.

  var cubeVertexIndices = [
    0,  1,  2,      0,  2,  3    // front
  ]

  // Now send the element array to GL

  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,
      new Uint16Array(cubeVertexIndices), gl.STATIC_DRAW);
}

//
// initTextures
//
// Initialize the textures we'll be using, then initiate a load of
// the texture images. The handleTextureLoaded() callback will finish
// the job; it gets called each time a texture finishes loading.
//
function initTextures() {
  sourceTexture = gl.createTexture();
}

function initTexture(img, url, npot) {
  var tex = gl.createTexture();
  img = new Image();
  img.onload = function() { handleTextureLoaded(tex, img, npot); }
  img.src = url;
  console.log("init", img);
  return tex;
}

function handleTextureLoaded(texture, image, npot) {
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  if (npot) {
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  } else {
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
    gl.generateMipmap(gl.TEXTURE_2D);
  }
  gl.bindTexture(gl.TEXTURE_2D, null);
  console.log("loaded", image);
}

//
// updateTexture
//
// Update the texture to contain the latest frame from
// our video.
//
function updateTexture() {
  gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA,
        gl.UNSIGNED_BYTE, mediaElement);
  /*for NPOT textures, see as well: https://www.khronos.org/webgl/wiki/WebGL_and_OpenGL_Differences*/
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  /*for pot textures*/
  // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
  // gl.generateMipmap(gl.TEXTURE_2D);
  gl.bindTexture(gl.TEXTURE_2D, null);
  // console.log("media element", mediaElement);
}

//
// drawScene
//
// Draw the scene.
//
function drawScene() {
  if (srcTexInfo.shouldUpdate) {
    updateTexture();
  }
  fitCanvas();
  // Clear the canvas before we start drawing on it.

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.bindBuffer(gl.ARRAY_BUFFER, cubeVerticesBuffer);
  gl.vertexAttribPointer(vertexPositionAttribute, 3, gl.FLOAT, false, 0, 0);

  // Set the texture coordinates attribute for the vertices.

  gl.bindBuffer(gl.ARRAY_BUFFER, cubeVerticesTextureCoordBuffer);
  gl.vertexAttribPointer(textureCoordAttribute, 2, gl.FLOAT, false, 0, 0);

  //setting uniforms
  params.forEach(function(param) {
    switch(param['type']) {
      case 'float':
        switch(param['value'].length) {
          case 1:
            gl.uniform1f(param['uloc'], param['value'][0]);
          break;
          case 2:
            gl.uniform2f(param['uloc'], param['value'][0], param['value'][1]);
          break;
          case 3:
            gl.uniform3f(param['uloc'], param['value'][0], param['value'][1], param['value'][2]);
          break;
        }
        break;
      case 'int':
        switch(param['value'].length) {
          case 1:
            gl.uniform1i(param['uloc'], param['value'][0]);
          break;
          case 2:
            gl.uniform2i(param['uloc'], param['value'][0], param['value'][1]);
          break;
          case 3:
            gl.uniform3i(param['uloc'], param['value'][0], param['value'][1], param['value'][2]);
          break;
        }
        break;
    }
  });


  gl.uniform2f(uSizeLoc, gl.canvas.width, gl.canvas.height);

  gl.uniform1i(uShowGridLoc, showGrid);
  gl.uniform1i(uSrcTexProjTypeLoc, srcTexInfo.projection_type);
  // Specify the texture to map onto the faces.

  var unitNo = 0;
  gl.activeTexture(gl.TEXTURE0 + unitNo);
  gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
  gl.uniform1i(uSrcTexLoc, unitNo);
  unitNo++;

  // Draw the quad.

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeVerticesIndexBuffer);
  gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

  gl.bindTexture(gl.TEXTURE_2D, null);
}

//
// initShaders
//
// Initialize the shaders, so WebGL knows how to light our scene.
//
function initShaders() {
  /*
  loadFiles(['./glsl/domeviewer.vert', './glsl/domeviewer.frag'], function (shaderText) {
  */
  var shaderText = [];
  shaderText.push(glslify(__dirname + '/../glsl/domeviewer.vert'));
  shaderText.push(glslify(__dirname + '/../glsl/domeviewer.frag'));
  console.log(shaderText[1]);
      var vertexShader = gl.createShader(gl.VERTEX_SHADER);
      gl.shaderSource(vertexShader, shaderText[0]);
      gl.compileShader(vertexShader);

      var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
      gl.shaderSource(fragmentShader, shaderText[1]);
      gl.compileShader(fragmentShader);

      if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        alert("An error occurred compiling the shaders: " + gl.getShaderInfoLog(vertexShader));
        return null;
      }
      if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        alert("An error occurred compiling the shaders: " + gl.getShaderInfoLog(fragmentShader));
        return null;
      }
      // Create the shader program
      shaderProgram = gl.createProgram();
      gl.attachShader(shaderProgram, vertexShader);
      gl.attachShader(shaderProgram, fragmentShader);
      gl.linkProgram(shaderProgram);

      // If creating the shader program failed, alert

      if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        alert("Unable to initialize the shader program.");
      }

      gl.useProgram(shaderProgram);

      vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
      gl.enableVertexAttribArray(vertexPositionAttribute);

      textureCoordAttribute = gl.getAttribLocation(shaderProgram, "aTextureCoord");
      gl.enableVertexAttribArray(textureCoordAttribute);

      //getting uniform locations
      uSrcTexLoc = gl.getUniformLocation(shaderProgram, "uSrcTex");
      uSizeLoc = gl.getUniformLocation(shaderProgram, "uSize");
      uShowGridLoc = gl.getUniformLocation(shaderProgram, "uShowGrid");
      uSrcTexProjTypeLoc = gl.getUniformLocation(shaderProgram, "uSrcTexProjType");
      /*
      domeRadiusULoc = gl.getUniformLocation(shaderProgram, "sphereRadius");
      domePositionULoc = gl.getUniformLocation(shaderProgram, "spherePosition");
      domeOrientationULoc = gl.getUniformLocation(shaderProgram, "sphereOrientation");
      domeLatitudeULoc = gl.getUniformLocation(shaderProgram, "sphereLatitude");
      */
      params.forEach(function(param) {
        param["uloc"] = gl.getUniformLocation(shaderProgram, param["name"]);
      });
/*
  }, function (url) {
      alert('Failed to download "' + url + '"');
  });
  */
}

var panTiltOn = true;
var dollyOn = false;
var zoomOn = false;
var activePointerCount = 0;
var mainPointerId = -1;
var panTiltFactor = 0.1;
var dollyFactor = 0.1;
var zoomFactor = 0.1;

function initInput() {
  var pointerSensitiveElement = document.getElementById('glcanvas');
  pointerSensitiveElement.addEventListener('mousedown', function(event) {
    event.preventDefault();
    // console.log('mouse down');
    pointerSensitiveElement.addEventListener('mousemove',handlePointerMoved,true);
  });
  pointerSensitiveElement.addEventListener('mouseup', function(event) {
    event.preventDefault();
    // sole.log('pointer up');
    pointerSensitiveElement.removeEventListener('mousemove',handlePointerMoved,true);
  });
  /*
  pointerSensitiveElement.addEventListener('keydown', function(event) {
    switch (event.code) {
      case 'ShiftLeft':
      case 'ShiftRight':
        panTiltOn = false;
        dollyOn = true;
        zoomOn = false;
      break;
      case 'AltLeft':
      case 'AltRight':
        panTiltOn = false;
        dollyOn = false;
        zoomOn = true;
      break;
    }
    console.log("dolly ", dollyOn, " zoom ", zoomOn);
  });
  pointerSensitiveElement.addEventListener('keyup', function(event) {
    switch (event.code) {
      case 'ShiftLeft':
      case 'ShiftRight':
      case 'AltLeft':
      case 'AltRight':
        panTiltOn = true;
        dollyOn = false;
        zoomOn = false;
      break;
    }
    console.log("dolly ", dollyOn, " zoom ", zoomOn);
  });
  */
}

function handlePointerMoved(event) {
  event.preventDefault();
  var dx = event.movementX;
  var dy = event.movementY;
  if (event.altKey) {
    var newValueY = getParam('uHorizontalFOV', 0) + dy * zoomFactor;
    triggerEvent('uHorizontalFOV-input', newValueY);
    setParam('uHorizontalFOV', newValueY, 0);
  } else if (event.shiftKey) {
    var newValueX = getParam('uCameraPosition', 0) + dx * panTiltFactor;
    var newValueY = getParam('uCameraPosition', 2) + dy * panTiltFactor;
    triggerEvent('uCameraPosition-X-input', newValueX);
    triggerEvent('uCameraPosition-Z-input', newValueY);
    setParam('uCameraPosition', newValueX, 0);
    setParam('uCameraPosition', newValueY, 2);
    // console.log(dx, dy, newValueX, newValueY);
  } else {
    var newValueX = getParam('uCameraOrientation', 0) - dx * panTiltFactor;
    var newValueY = getParam('uCameraOrientation', 1) + dy * panTiltFactor;
    triggerEvent('uCameraOrientation-X-input', newValueX);
    triggerEvent('uCameraOrientation-Y-input', newValueY);
    setParam('uCameraOrientation', newValueX, 0);
    setParam('uCameraOrientation', newValueY, 1);
    // console.log(dx, dy, newValueX, newValueY);
  }
}

function triggerEvent(id, newValue) {
  var elem = document.getElementById(id);
  elem.value = newValue;
  var event = new Event('input', {
      target: elem,
      type: 'Event',
      bubbles: false,
      cancelable: false
  });
  elem.dispatchEvent(event);
}

function handlePointerStart(event) {

}

function handlePointerEnd(event) {

}


//source:
//http://stackoverflow.com/questions/4878145/javascript-and-webgl-external-scripts
function loadFile(url, data, callback, errorCallback) {
    // Set up an asynchronous request
    var request = new XMLHttpRequest();
    request.open('GET', url, true);

    // Hook the event that gets called as the request progresses
    request.onreadystatechange = function () {
        // If the request is "DONE" (completed or failed)
        if (request.readyState == 4) {
            // If we got HTTP status 200 (OK)
            if (request.status == 200) {
                callback(request.responseText, data)
            } else { // Failed
                errorCallback(url);
            }
        }
    };

    request.send(null);
}

function loadFiles(urls, callback, errorCallback) {
    var numUrls = urls.length;
    var numComplete = 0;
    var result = [];

    // Callback for a single file
    function partialCallback(text, urlIndex) {
        result[urlIndex] = text;
        numComplete++;

        // When all files have downloaded
        if (numComplete == numUrls) {
            callback(result);
        }
    }

    for (var i = 0; i < numUrls; i++) {
        loadFile(urls[i], i, partialCallback, errorCallback);
    }
}

function setupFileHandling() {
  //source: http://codepen.io/SpencerCooley/pen/JtiFL/
  //check if browser supports file api and filereader features
  mediaContainer = document.getElementById("media-container");
  if (window.File && window.FileReader && window.FileList && window.Blob) {

    //console.log(document);
    document.getElementById("the-video-file-field").addEventListener('change', function(event) {
  		//grab the first image in the fileList
  		//in this example we are only loading one file.
      console.log("file field event", event, event.files);
      var file = this.files[0];
      if (file !== undefined) {
        console.log("file size:", file.size);
        console.log("file type:", file.type);
        //TODO: decide media type here?
        if(file.type.match(/video\/*/)){
    		  initVideo(this.files[0]);
        } else if (file.type.match(/image\/*/)) {
          //TODO:
          initImage(this.files[0]);
        } else {
          console.log("Couldn't interpret image/video file: ", this.files[0]);
        }
      } else {
        console.log("probably cancelled.");
      }
  	}, false);

  } else {
    alert('The File APIs are not fully supported in this browser.');
  }
}

function clearVideo() {
  try {
    videoDone();
    var videoElement = mediaContainer.getElementsByTagName("video")[0];
    videoElement.pause();
    videoElement.setAttribute("src", "");
    //videoElement.removeAttribute("src");
    videoElement.load();
    videoElement.removeEventListener("canplaythrough", startVideo, true);
    videoElement.removeEventListener("ended", videoDone, true);
    mediaContainer.removeChild(videoElement);
    // window.URL.revokeObjectURL(currentURL);
  } catch (e) {
    console.error(e);
  }
}

//this is not completely neccesary, just a nice function I found to make the file size format friendlier
//http://stackoverflow.com/questions/10420352/converting-file-size-in-bytes-to-human-readable
function humanFileSize(bytes, si) {
   var thresh = si ? 1000 : 1024;
   if(bytes < thresh) return bytes + ' B';
   var units = si ? ['kB','MB','GB','TB','PB','EB','ZB','YB'] : ['KiB','MiB','GiB','TiB','PiB','EiB','ZiB','YiB'];
   var u = -1;
   do {
       bytes /= thresh;
       ++u;
   } while(bytes >= thresh);
   return bytes.toFixed(1)+' '+units[u];
}

function initImage(file){
  console.log("file from inside init image", file);
  currentURL = (file instanceof File) ? URL.createObjectURL(file) : file;
   //TODO: check and stop existing media!
   //TODO: on cancel?
   srcTexInfo.shouldUpdate = false;

   if (srcTexInfo.type === 'video') {
     clearVideo();
   }
   if (srcTexInfo.type === 'image') {
     clearImage();
   }

   var imageElement = document.createElement("img");

   imageElement.addEventListener('load', loadImageCallback, true);

   imageElement.setAttribute('src', currentURL);
   mediaContainer.appendChild(imageElement);
   mediaElement = imageElement;
   //DEBUGGING

   srcTexInfo.type = 'image';
   srcTexInfo.shouldUpdate = true;
   console.log("init image called", mediaElement);
}

function initVideo(file){
   currentURL = URL.createObjectURL(file);
   //TODO: check and stop existing media!
   //TODO: on cancel?
   srcTexInfo.shouldUpdate = false;

   if (srcTexInfo.type === 'video') {
     clearVideo();
   }
   if (srcTexInfo.type === 'image') {
     clearImage();
   }

   //of course using a template library like handlebars.js is a better solution than just inserting a string
   var videoElement = document.createElement("video");
   videoElement.addEventListener("canplaythrough", startVideo.bind(videoElement), true);
   videoElement.addEventListener("ended", videoDone, true);
   videoElement.setAttribute('src', currentURL);
   videoElement.setAttribute('autoplay', '');
   // videoElement.setAttribute('muted', '');
   videoElement.setAttribute('loop', '');
   videoElement.setAttribute('type', file.type);
   mediaContainer.appendChild(videoElement);
   mediaElement = videoElement;
}

function clearImage() {
  try {
    clearInterval(intervalID);
    var imageElement = mediaContainer.getElementsByTagName("img")[0];
    imageElement.setAttribute("src", "");
    //videoElement.removeAttribute("src");
    imageElement.removeEventListener("load", loadImageCallback, true);
    mediaContainer.removeChild(imageElement);
    // window.URL.revokeObjectURL(currentURL);
  } catch (e) {
    console.error(e);
  }
}

function loadImageCallback() {
  srcTexInfo.type = 'image';
  srcTexInfo.shouldUpdate = true;
  intervalID = setInterval(drawScene, 120);
  console.log("load image callback triggered.");
}

//
// startVideo
//
// Starts playing the video, so that it will start being used
// as our texture.
//
function startVideo() {
  this.play();
  this.muted = true;
  intervalID = setInterval(drawScene, 30);
  srcTexInfo.type = 'video';
  srcTexInfo.shouldUpdate = true;
  //console.log("start video", doUpdateTexture);
}

//
// videoDone
//
// Called when the video is done playing; this will terminate
// the animation.
//
function videoDone() {
  clearInterval(intervalID);
  console.log("video done called");
}

function initGUI() {
  var uiContainer = document.getElementById('ui');
  var projTypeLabel = document.createElement('span');
  projTypeLabel.textContent = 'projection type:';
  var projTypeDropdown = document.createElement('select');
  var projections = ['equirectangular', 'azimuthal-90', 'azimuthal-180'];
  var i = 0;
  projections.forEach(function(proj) {
    var opt = document.createElement('option');
    opt.value = i;
    opt.textContent = proj;
    projTypeDropdown.appendChild(opt);
    i++;
  });
  projTypeDropdown.addEventListener('change', function(event) {
    srcTexInfo.projection_type = event.target.value;
    console.log("proj type", srcTexInfo.projection_type);
  });

  uiContainer.appendChild(projTypeLabel);
  uiContainer.appendChild(projTypeDropdown);
  params.forEach(function(param) {
    for (var i  = 0; i < param['value'].length; i++) {
      var labelElement = document.createElement('span');
      labelElement.textContent = param['label'][i];
      var numberInput = document.createElement('input');
      numberInput.type = 'number';
      numberInput.id = param['name'] + param['suffix'][i] + "-input";
      // numberInput.min = param['min'][i];
      numberInput.value = param['value'][i];
      // numberInput.max = param['max'][i];
      // numberInput.size = '4';
      numberInput.className = 'number-input';

      var rangeInput = document.createElement('input');
      rangeInput.type = 'range';
      rangeInput.id = param['name'] + param['suffix'][i] + "-slider";
      if (param['step'] !== undefined) {
        rangeInput.step = param['step'][i];
      }
      rangeInput.min = parseFloat(param['min'][i]);
      rangeInput.value = parseFloat(param['value'][i]);
      rangeInput.max = parseFloat(param['max'][i]);

      rangeInput.className = 'full-width';

      rangeInput.addEventListener('input', function(otherInput, param, index, event) {
        // console.log(event, otherInput, param, index);
        event.preventDefault();
        param['value'][index] = event.target.value;
        otherInput.value = event.target.value;
      }.bind(null, numberInput, param, i));
      numberInput.addEventListener('input', function(otherInput, param, index, event) {
        // console.log(event, otherInput, param, index);
        event.preventDefault();
        param['value'][index] = event.target.value;
        otherInput.value = event.target.value;
      }.bind(null, rangeInput, param, i));

      uiContainer.appendChild(labelElement);
      uiContainer.appendChild(numberInput);
      uiContainer.appendChild(rangeInput);
      // console.log(labelElement);
      // console.log(numberInput);
      // console.log(rangeInput);
    }
  });
  var showGridLabel = document.createElement('span');
  showGridLabel.textContent = "show grid";
  var showGridCheckBox = document.createElement('input');
  showGridCheckBox.type = "checkbox";
  showGridCheckBox.addEventListener('change', function(event) {
    showGrid = (showGrid + 1) % 2;
    console.log("chkbox", event.target.value, this.value);
  });
  uiContainer.appendChild(showGridLabel);
  uiContainer.appendChild(showGridCheckBox);
  console.log(showGridLabel, showGridCheckBox);
}

function initGUIElement(id, paramName, startingValue) {
  var startingValue = params[paramName];
  document.getElementById(id + "-slider").addEventListener('input',
    function(event) {
      document.getElementById(id+"-input").value = event.target.value;
      params[paramName] = event.target.value;
  });
  document.getElementById(id + "-input").addEventListener('input',
    function(event) {
      document.getElementById(id+"-slider").value = event.target.value;
      params[paramName] = event.target.value;
  });
  document.getElementById(id+"-slider").value = startingValue;
  document.getElementById(id+"-input").value = startingValue;
}

function deg2Rad(d) {
  return d * Math.PI / 180;
}

function rad2Deg(r) {
  return r * 180 / Math.PI;
}

function setParam(name, value, compIndex) {
  var paramIndex = getParamIndex(name);
  if (compIndex === undefined) {
    params[paramIndex].value[0] = value;
  } else {
    params[paramIndex].value[compIndex] = value;
  }
}

function getParam(name, compIndex) {
  var paramIndex = getParamIndex(name);
  if (compIndex === undefined) {
    return parseFloat(params[paramIndex].value[0] || '0.0');
  } else {
    return parseFloat(params[paramIndex].value[compIndex] || '0.0');
  }
}

function getParamIndex(name) {
  return params.findIndex(function (elem) {
    return elem.name === name;
  });
}

function setupParams() {
  params = [];
  params.push({
    name: "uHorizontalFOV",
    label: ["horizontal fov: "],
    suffix: [""],
    value: [120],
    type: "float",
    min: [5],
    max: [170]
  });
  params.push({
    name: "uCameraPosition",
    label: ["camera position x: ", "camera position y: ", "camera position z: "],
    suffix: ["-X", "-Y", "-Z"],
    value: [0, 0, 70],
    type: "float",
    min: [-100, -100, -100],
    max: [100, 100, 100]
  });
  params.push({
    name: "uCameraOrientation",
    label: ["camera orientation x: ", "camera orientation y: "],
    suffix: ["-X", "-Y"],
    value: [0, 0],
    type: "float",
    min: [-180, -180],
    max: [180, 180]
  });
  params.push({
    name: "uSphereRadius",
    label: ["dome radius: "],
    suffix: [""],
    value: [50],
    type: "float",
    min: [1],
    max: [100]
  });
  params.push({
    name: "uSphereOrientation",
    label: ["dome orientation x: ", "dome orientation y: "],
    suffix: ["-X", "-Y"],
    value: [0, 0],
    type: "float",
    min: [-180, -180],
    max: [180, 180]
  });
  params.push({
    name: "uSphereLatitude",
    label: ["dome latitude: "],
    suffix: [""],
    value: [90],
    type: "float",
    min: [0],
    max: [180]
  });
  /*
  params.push({
    name: "uSpherePosition",
    label: ["dome position x: ", "dome position y: ", "dome position z: "],
    suffix: ["-X", "-Y", "-Z"],
    value: [0, 0, 0],
    type: "float",
    min: [-100, -100, -100],
    max: [100, 100, 100]
  });
  */
  /*
  params.push({
    name: "uNearPlane",
    label: ["near plane: "],
    suffix: [""],
    value: [0.05],
    type: "float",
    min: [-1.0],
    max: [1.0],
    step: [0.005]
  });
  */
}
