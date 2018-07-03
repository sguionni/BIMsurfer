#version 300 es

precision mediump int;
precision mediump float;

in ivec3 vertexPosition;
in vec3 vertexNormal;
in vec4 vertexColor;
in mat4 instances;

uniform mat4 vertexQuantizationMatrix;
uniform mat4 projectionMatrix;
uniform mat4 normalMatrix;
uniform mat4 modelViewMatrix;

uniform LightData {
	vec3 lightPosition;
	vec3 lightColor;
	vec3 ambientColor;
	float shininess;
} lightData;

out mediump vec4 color;
out mediump vec3 vertex;
out mediump vec3 normal;

void main(void) {
  vec4 floatVertex = vec4(float(vertexPosition.x), float(vertexPosition.y), float(vertexPosition.z), 1);
  floatVertex = vertexQuantizationMatrix * floatVertex;
  vertex = vec3( projectionMatrix * modelViewMatrix * instances * floatVertex);

  normal = vec3( normalMatrix * instances * vec4(vertexNormal, 0.0));

  color = vertexColor;

  gl_Position = projectionMatrix * modelViewMatrix * instances * floatVertex;
}