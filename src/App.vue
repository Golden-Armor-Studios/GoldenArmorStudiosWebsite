<template>
  <img class="logo" alt="Vue logo" src="./assets/Golden_Armor_Logo.png">
  <h1 class="silkscreen-bold homepage-title">Golden Armor Studios</h1>
  <p class="winky-sans-400 homepage-p">Check out our current game Color IQ Pro Test.</p>
  <video class="color-iq-video" controls autoplay loop>
    <source src="Color_IQ_Logo.mp4" type="video/mp4">
    Your browser does not support the video tag.
  </video>
  <p class="homepage-p">Click here to help with the Dev Team!</p>
  <a class="homepage-p homepage-link" href="https://github.com/Golden-Armor-Studios/ColorIQ">https://github.com/Golden-Armor-Studios/ColorIQ</a>
  <p class="homepage-p">We are looking for suggestions and collaborators.</p>
</template>

<script>

export default {
  name: 'App',
  components: {
   
  }
}
</script>

<style>
.homepage-link {
  color: rgb(75, 216, 122) !important;
}
.color-iq-video {
  width: 200px;
}
.silkscreen-regular {
  font-family: "Silkscreen", sans-serif;
  font-weight: 400;
  font-style: normal;
}

.silkscreen-bold {
  font-family: "Silkscreen", sans-serif;
  font-weight: 700;
  font-style: normal;
}
.winky-sans-400 {
  font-family: "Winky Sans", sans-serif;
  font-optical-sizing: auto;
  font-weight: 400;
  font-style: normal;
}
body {
  background-color: #21252a;
}
.logo {
  width: 200px;
}
.homepage-p {
  font-size: 1.5em;
  color: white;
}
.homepage-title {
  font-size: 3.5em;
  color: white;
}

#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
</style>
