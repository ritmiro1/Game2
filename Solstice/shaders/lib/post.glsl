// Filmic contrast and subtle chromatic grading.
vec3 solsticeGrade(vec3 c,float exposure,float sat){c=solsticeACES(c*exposure);float y=dot(c,vec3(0.2126,0.7152,0.0722));c=mix(vec3(y),c,sat);return c;}
