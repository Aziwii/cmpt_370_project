class Game {
  constructor(state) {
    this.state = state;
    this.spawnedObjects = [];
    this.collidableObjects = [];
    this.currentLane = 0;
    this.speed = 10;

    this.score = 0;
    this.highscore = Number(localStorage.getItem("highscore")) || 0;
    this.gameState = "MENU"; //either MENU PLAYING or GAMEOVER
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

    // Give the player a sphere collider and define what happens when it hits something
    this.createSphereCollider(this.player, 0.45, (otherObject) => {
      if (otherObject.tag === "obstacle") {
        this.gameOver();
      }
      // Later, you can add: else if (otherObject.tag === "coin") { ... }
    });

    // Give each obstacle a sphere collider too
    this.obstacles.forEach((obs) => {
      obs.tag = "obstacle";
      this.createSphereCollider(obs, 0.55);
    });

  
    // Grab UI elements
    this.hud = document.getElementById("hud");
    this.menu = document.getElementById("menu");
    this.menuTitle = document.getElementById("menuTitle");
    this.scoreText = document.getElementById("scoreText");
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
    // Reset player and speed
    this.currentLane = 0;
    this.speed = 10;
    this.score = 0;
    this.player.model.position[0] = 0;

    // Reset obstacles back to their starting Z positions
    const startZ = [-10, -20, -30, -40];
    this.obstacles.forEach((obs, i) => {
      obs.model.position[2] = startZ[i];
      obs.model.position[0] = Math.floor(Math.random() * 3) - 1;
    });

    this.gameState = "PLAYING";
    this.menu.style.display = "none";
    this.hud.style.display = "block";
  }

  gameOver() {
    this.gameState = "GAMEOVER";
    const finalScore = Math.floor(this.score);

    if (finalScore > this.highScore) {
      this.highScore = finalScore;
      localStorage.setItem("highScore", this.highScore);
      this.highScoreText.textContent = this.highScore;
    }

    this.menuTitle.textContent = "Game Over!";
    this.finalScoreText.textContent = `Score: ${finalScore} | High Score: ${Math.floor(this.highScore)}`;
    document.getElementById("startBtn").textContent = "Play Again";
    this.menu.style.display = "block";
  }

  exitToMenu() {
    this.gameState = "MENU";
    this.hud.style.display = "none";
    this.menuTitle.textContent = "Temple Run";
    this.finalScoreText.textContent = `High Score: ${Math.floor(this.highScore)}`;
    document.getElementById("startBtn").textContent = "Start Game";
    this.menu.style.display = "block";
  }

  // Runs once every frame non stop after the scene loads
  onUpdate(deltaTime) {
    // TODO - Here we can add game logic, like moving game objects, detecting collisions, you name it. Examples of functions can be found in sceneFunctions
    if (this.gameState !== "PLAYING" || deltaTime > 0.1) return;

    this.score += this.speed * deltaTime;
    this.scoreText.textContent = Math.floor(this.score);

    // increase speed
    if (this.speed < 30) {
    this.speed += 0.3 * deltaTime;
    }
    
    // Move obstacles and check collisions
    for (const obs of this.obstacles) {
      const obsPos = obs.model.position;
      obsPos[2] += this.speed * deltaTime;

      if (this.checkCollision(obs)) {
        this.gameOver();
        return;
      }

      if (obsPos[2] > 4.0) {
        obsPos[2] -= 40.0;
        obsPos[0] = Math.floor(Math.random() * 3) - 1;
      }
    }

    //player movement
    const playerPos = this.player.model.position;
    playerPos[0] += (this.currentLane - playerPos[0]) * 15.0 * deltaTime;

    this.checkCollision(this.player);

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
