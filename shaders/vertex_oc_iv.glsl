#version 300 es

precision mediump int;
precision mediump float;

in ivec3 vertexPosition;
in vec3 vertexNormal;

uniform mat4 vertexQuantizationMatrix;
uniform vec4 objectColor;
uniform mat4 projectionMatrix;
uniform mat4 viewNormalMatrix;
uniform mat4 viewMatrix;

uniform LightData {
	vec3 lightPosition;
	vec3 lightColor;
	vec3 ambientColor;
	float shininess;
} lightData;

out mediump vec4 color;

void main(void) {

  vec4 floatVertex = vertexQuantizationMatrix *vec4(float(vertexPosition.x), float(vertexPosition.y), float(vertexPosition.z), 1);
  vec3 viewNormal = vec3(viewNormalMatrix * vec4(vertexNormal, 0.0));
  vec3 lightDir = vec3(0.5, 0.5, 0.5);
  float lambertian = max(dot(viewNormal, lightDir), 0.0);

  gl_Position = projectionMatrix * viewMatrix * floatVertex;
  color = vec4(lambertian + objectColor.rgb, objectColor.a);
}