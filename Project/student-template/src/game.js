class Game {
  constructor(state) {
    this.state = state;
    this.spawnedObjects = [];
    this.collidableObjects = [];
    this.currentLane = 0;
    this.speed = 10;

    this.score = 0;
    this.coinsCollected = 0;
    this.coinValue = 10;
    this.highscore = Number(localStorage.getItem("highscore")) || 0;

    this.maxTorchTime = 10.0;
    this.torchTime = this.maxTorchTime;
    this.maxTorchStrength = 10;
    this.coinTorchBonus = 3.0;

    this.gameState = "MENU"; //either MENU PLAYING or GAMEOVER

    this.firstPerson = false;
  }

  // example - we can add our own custom method to our game and call it using 'this.customMethod()'
  // customMethod() {
  //   console.log("Custom method!");
  // }

  // example - create a collider on our object with various fields we might need (you will likely need to add/remove/edit how this works)
  createSphereCollider(object, radius, onCollide = null) {
    object.collider = {
      type: "SPHERE",
      radius: radius,
      onCollide: onCollide ? onCollide : (otherObject) => {
        console.log(`Collided with ${otherObject.name}`);
      }
    };
    this.collidableObjects.push(object);
  }

  // Helper matching drawScene() in main.js to get true world-space position
  getWorldCenter(object) {
    let center = vec4.fromValues(
      object.centroid[0],
      object.centroid[1],
      object.centroid[2],
      1.0
    );
    vec4.transformMat4(center, center, object.modelMatrix);
    return vec3.fromValues(center[0], center[1], center[2]);
  }

  // example - function to check if an object is colliding with collidable objects
  // check one object against all collidableObjects
  checkCollision(object) {
    if (!object.collider || !object.modelMatrix) return;

    const objPos = this.getWorldCenter(object);

    this.collidableObjects.forEach(otherObject => {
      if (object.name === otherObject.name || !otherObject.modelMatrix) {
        return;
      }

      const otherPos = this.getWorldCenter(otherObject);
      const distance = vec3.distance(objPos, otherPos);

      if (distance < object.collider.radius + otherObject.collider.radius) {
        // Trigger the callback defined on the object (and/or the otherObject)
        object.collider.onCollide(otherObject);
      }
    });
  }

  // runs once on startup after the scene loads the objects
  async onStart() {
    this.player = getObject(this.state, "player");
    this.obstacles = [
      getObject(this.state, "obstacle1"),
      getObject(this.state, "obstacle2"),
      getObject(this.state, "obstacle3"),
      getObject(this.state, "obstacle4")
    ];

    //use the scene light as the player torch
    this.playerLight = this.state.pointLights[0];
    this.playerLight.colour = [1.0, 0.9, 0.7];
    this.playerLight.strength = this.maxTorchStrength;
    this.playerLight.linear = 0.25;
    this.playerLight.quadratic = 0.15;

    //add the redpoint light to each obstacle
    this.obstacles.forEach((obs) => {
      obs.tag = "obstacle";
      this.createSphereCollider(obs, 0.45);
      obs.material.ambient = [0.0, 0.0, 0.0];
    });

    // Track, walls, and player go pitch black when torch dies
    ["track", "left wall", "left wall-copy", "player"].forEach((name) => {
      const obj = getObject(this.state, name);
      if (obj) obj.material.ambient = [0.0, 0.0, 0.0];
    });

    // create 3 spinning yellow coins with yellow point lights
    this.coins = [];
    const coinStartZ = [-15, -25, -35];
    for (let i = 0; i < 3; i++) {
      const coin = addCube({
        name: `coin${i}`,
        type: "cube",
        material: {
          diffuse: [1.0, 0.85, 0.1],
          ambient: [0.35, 0.35, 0.35], // Soft golden glow instead of blinding bright
          specular: [1.0, 1.0, 1.0],
          n: 32
        },
        position: [Math.floor(Math.random() * 3) - 1, 0.5, coinStartZ[i]],
        scale: [0.6, 0.6, 0.6]
      }, this.state);

      coin.tag = "coin";
      this.createSphereCollider(coin, 0.25);

      const yellowLight = {
        name: `coin-light-${i}`,
        colour: [1.0, 0.85, 0.1],
        position: [coin.model.position[0], 1.0, coin.model.position[2]],
        strength: 2.0,     // Much softer (down from 10)
        linear: 0.5,       // Tighter radius
        quadratic: 1.5     // Fast falloff so it doesn't light the whole tunnel
      };
      this.state.pointLights.push(yellowLight);
      coin.light = yellowLight;

      this.coins.push(coin);
    }

    // update numLights so the shader loops over the new lights
    this.state.numLights = this.state.pointLights.length;

    // give the player a sphere collider and define what happens when it hits something
    this.createSphereCollider(this.player, 0.3, (otherObject) => {
      if (otherObject.tag === "obstacle") {
        this.gameOver();
      } else if (otherObject.tag === "coin") {
        this.coinsCollected += 1;
        this.score += this.coinValue;
        this.coinText.textContent = this.coinsCollected;

        // Add time back to the torch (capped at maxTorchTime)
        this.torchTime = Math.min(this.maxTorchTime, this.torchTime + this.coinTorchBonus);

        // Respawn coin down the track in a random lane
        otherObject.model.position[2] -= 40.0;
        otherObject.model.position[0] = Math.floor(Math.random() * 3) - 1;
        otherObject.light.position[2] = otherObject.model.position[2];
      }
    });

    // Grab UI elements (add torchText & torchBar)
    this.torchText = document.getElementById("torchText");
      this.torchBar = document.getElementById("torchBar");
      this.multiplierText = document.getElementById("multiplierText");


    // Grab UI elements
    this.hud = document.getElementById("hud");
    this.menu = document.getElementById("menu");
    this.menuTitle = document.getElementById("menuTitle");
    this.scoreText = document.getElementById("scoreText");
    this.coinText = document.getElementById("coinText");
    this.highScoreText = document.getElementById("highScoreText");
    this.finalScoreText = document.getElementById("finalScoreText");

    this.highScoreText.textContent = Math.floor(this.highScore);

    document.getElementById("startBtn").addEventListener("click", () => this.startGame());
    document.getElementById("exitBtn").addEventListener("click", () => this.exitToMenu());

    document.addEventListener("keydown", (e) => {
      if (this.gameState !== "PLAYING") return;

      if ((e.key === "a" || e.key === "ArrowLeft") && this.currentLane > -1) {
        this.currentLane--;
      } else if ((e.key === "d" || e.key === "ArrowRight") && this.currentLane < 1) {
        this.currentLane++;
      } else if (e.key === "r") {
        this.firstPerson = !this.firstPerson;
      }
    });




    // // example - create sphere colliders on our two objects as an example, we give 2 objects colliders otherwise
    // // no collision can happen
    // this.createSphereCollider(this.cube, 0.5, (otherObject) => {
    //   console.log(`This is a custom collision of ${otherObject.name}`)
    // });
    // // this.createSphereCollider(otherCube, 0.5);

    // // example - setting up a key press event to move an object in the scene
    // document.addEventListener("keypress", (e) => {
    //   e.preventDefault();

    //   switch (e.key) {
    //     case "a":
    //       this.cube.translate(vec3.fromValues(0.5, 0, 0));
    //       break;

    //     case "d":
    //       this.cube.translate(vec3.fromValues(-0.5, 0, 0));
    //       break;

    //     default:
    //       break;
    //   }
    // });

    // calling our custom method! (we could put spawning logic, collision logic etc in there ;)
    // this.customMethod();

    // example: spawn some stuff before the scene starts
    // for (let i = 0; i < 10; i++) {
    //     for (let j = 0; j < 10; j++) {
    //         for (let k = 0; k < 10; k++) {
    //             spawnObject({
    //                 name: `new-Object${i}${j}${k}`,
    //                 type: "cube",
    //                 material: {
    //                     diffuse: randomVec3(0, 1)
    //                 },
    //                 position: vec3.fromValues(4 - i, 5 - j, 10 - k),
    //                 scale: vec3.fromValues(0.5, 0.5, 0.5)
    //             }, this.state);
    //         }
    //     }
    // }

    // example: spawn in objects, set constantRotate to true for them (used below) and give them a collider
    //   for (let i = 0; i < 2; i++) {
    //     let tempObject = await spawnObject({
    //       name: `new-Object${i}`,
    //       type: "cube",
    //       material: {
    //         diffuse: randomVec3(0, 1)
    //       },
    //       position: vec3.fromValues(4 - i, 0, 0),
    //       scale: vec3.fromValues(0.5, 0.5, 0.5)
    //     }, this.state);


    //     tempObject.constantRotate = true;         // lets add a flag so we can access it later
    //     this.spawnedObjects.push(tempObject);     // add these to a spawned objects list
    //     this.collidableObjects.push(tempObject);  // say these can be collided into
    //   }
  }

  startGame() {
    this.currentLane = 0;
    this.speed = 10;
    this.score = 0;
    this.coinsCollected = 0;
    this.coinText.textContent = "0";
    this.player.model.position[0] = 0;

    this.graceTimer = 2.0;

    //reset labels
    if (this.multiplierText) {
      this.multiplierText.textContent = "1x";
      this.multiplierText.style.color = "#cccccc";
    }

    // reset torch light
    this.torchTime = this.maxTorchTime;
    this.playerLight.strength = this.maxTorchStrength;
    this.playerLight.colour = [1.0, 0.9, 0.7];

    // reset obstacles back to their starting Z positions
    const startZ = [-20, -30, -40, -50];
    this.obstacles.forEach((obs, i) => {
      obs.model.position[2] = startZ[i];
      obs.model.position[0] = Math.floor(Math.random() * 3) - 1;
    });

    // reset coins back to their starting Z positions
    const coinStartZ = [-15, -25, -35];
    this.coins.forEach((coin, i) => {
      coin.model.position[2] = coinStartZ[i];
      coin.model.position[0] = Math.floor(Math.random() * 3) - 1;
      coin.light.position = [coin.model.position[0], 1.0, coin.model.position[2]];
    });

    this.gameState = "PLAYING";
    this.menu.style.display = "none";
    this.hud.style.display = "block";

    if (document.activeElement) document.activeElement.blur(); //so we dont reclick ui with spacebar
  }

  gameOver() {
    this.gameState = "GAMEOVER";
    const distanceScore = Math.floor(this.score);
    // const coinBonus = this.coinsCollected * this.coinValue;
    const finalScore = Math.floor(this.score);

    if (finalScore > this.highscore) {
      this.highscore = finalScore;
      localStorage.setItem("highscore", this.highscore);
      this.highScoreText.textContent = this.highscore;
    }

    this.menuTitle.textContent = "Game Over!";
    this.finalScoreText.textContent =
      `Score: ${finalScore} | Coins Collected: ${this.coinsCollected} | High Score: ${Math.floor(this.highscore)}`;
    this.menu.style.display = "block";
  }

  exitToMenu() {
    this.gameState = "MENU";
    this.hud.style.display = "none";
    this.menuTitle.textContent = "Temple Run";
    this.finalScoreText.textContent = `High Score: ${Math.floor(this.highscore)}`;
    document.getElementById("startBtn").textContent = "Start Game";
    this.menu.style.display = "block";
  }

  updateCamera() {
    const playerPos = this.player.model.position;
    const camera = this.state.camera;

    //change to first person pov
    if (this.firstPerson) {
      camera.position[0] = playerPos[0];
      camera.position[1] = playerPos[1] + 1.0;
      camera.position[2] = playerPos[2] - 0.5;

    }
    // back to 3rd person pov
    else {
      camera.position = [0, 3.5, 4.5];
      camera.pitch = -13.5;
    }
  }

  // Runs once every frame non stop after the scene loads
  onUpdate(deltaTime) {
    // TODO - Here we can add game logic, like moving game objects, detecting collisions, you name it. Examples of functions can be found in sceneFunctions
    if (this.gameState !== "PLAYING" || deltaTime > 0.1) return;

    this.score += this.speed * deltaTime;

    // increase speed
    if (this.speed < 40) {
      this.speed += 0.3 * deltaTime;
    }

    this.obstacles.forEach((obs) => {
      const obsPos = obs.model.position;
      obsPos[2] += this.speed * deltaTime;

      if (obsPos[2] > 4.0) {
        obsPos[2] -= 40.0;
        obsPos[0] = Math.floor(Math.random() * 3) - 1;
      }
    });

    // move, spin, and update coin lights
    this.coins.forEach((coin) => {
      const cPos = coin.model.position;
      cPos[2] += this.speed * deltaTime;
      coin.rotate('y', deltaTime * 3.0);

      if (cPos[2] > 4.0) {
        cPos[2] -= 40.0;
        cPos[0] = Math.floor(Math.random() * 3) - 1;
      }

      coin.light.position = [cPos[0], 1.0, cPos[2]];
    });

    // follow player with torch
    const playerPos = this.player.model.position;
    playerPos[0] += (this.currentLane - playerPos[0]) * 15.0 * deltaTime;
    this.playerLight.position = [playerPos[0], 2.0, playerPos[2]];

    // wait for graceTimer before draining the torch
    if (this.graceTimer > 0) {
      this.graceTimer -= deltaTime;
    } else {
      this.torchTime = Math.max(0, this.torchTime - deltaTime);
    }

    const torchRatio = this.torchTime / this.maxTorchTime;
    this.playerLight.strength = this.maxTorchStrength * torchRatio;

    // calculate score multiplier
    let multiplier = 1;
    if (this.torchTime === 0) {
      multiplier = 5;
    } else if (this.torchTime >= 8.0 && this.graceTimer <= 0) {
      multiplier = 2;
    }

    this.score += this.speed * deltaTime * multiplier;
    this.scoreText.textContent = Math.floor(this.score);

    // ppdate the torch bar & multiplier text
    if (this.torchText && this.torchBar) {
      const pct = Math.round(torchRatio * 100);
      this.torchText.textContent = `${pct}%`;
      this.torchBar.style.width = `${pct}%`;
      this.torchBar.style.background = pct < 30 ? "#ff4422" : "#ffcc33";
    }

    if (this.multiplierText) {
      if (multiplier === 5) {
        this.multiplierText.textContent = "5x DARKNESS BONUS!";
        this.multiplierText.style.color = "#ff5555";
      } else if (multiplier === 2) {
        this.multiplierText.textContent = "2x TORCH STREAK!";
        this.multiplierText.style.color = "#ffcc33";
      } else {
        this.multiplierText.textContent = "1x";
        this.multiplierText.style.color = "#cccccc";
      }
    }

    this.checkCollision(this.player);

    //update camera position
    this.updateCamera();

    // example: Rotate all objects in the scene marked with a flag
    // this.state.objects.forEach((object) => {
    //   if (object.constantRotate) {
    //     object.rotate('y', deltaTime * 0.5);
    //   }
    // });

    // simulate a collision between the first spawned object and 'cube' 
    // if (this.spawnedObjects[0].collidable) {
    //     this.spawnedObjects[0].onCollide(this.cube);
    // }

    // example: Rotate all the 'spawned' objects in the scene
    // this.spawnedObjects.forEach((object) => {
    //     object.rotate('y', deltaTime * 0.5);
    // });


    // example - call our collision check method on our cube
    // this.checkCollision(this.cube);
  }
}
