const express = require("express");
const path = require("path");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
const app = express();
app.use(express.json());

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

// User Login API
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `
    SELECT
      *
    FROM
      user
    WHERE 
      username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);

  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "doggy");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

// USER AUTHENTICATION

const authenticateToken = (request, response, next) => {
  let jwttoken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwttoken = authHeader.split(" ")[1];
  }
  if (authHeader === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwttoken, "doggy", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//API CALLS

const convertStateObjToResponseObj = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

const convertDistrictObjToResponseObj = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};

// GET states API

app.get("/states/", authenticateToken, async (request, response) => {
  const stateQuery = `
    SELECT *
    FROM 
    state;`;

  const stateObj = await db.all(stateQuery);
  response.send(
    stateObj.map((eachState) => convertStateObjToResponseObj(eachState))
  );
});

// GET specific state API

app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;

  const stateQuery = `
    SELECT *
    FROM 
    state
    WHERE 
    state_id='${stateId}';`;

  const stateObj = await db.get(stateQuery);
  response.send(convertStateObjToResponseObj(stateObj));
});

// ADD district API

app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const addQuery = `
    INSERT INTO
    district(district_name,state_id,cases,cured,active,deaths)
    VALUES
       ('${districtName}',${stateId},${cases},${cured},${active},${deaths});`;

  const addDistrict = await db.run(addQuery);
  response.send("District Successfully Added");
});

// GET specific district API

app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;

    const stateQuery = `
    SELECT *
    FROM 
    district
    WHERE 
    district_id=${districtId};`;

    const stateObj = await db.get(stateQuery);
    response.send(convertDistrictObjToResponseObj(stateObj));
  }
);

// DELETE district API

app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;

    const stateQuery = `
   DELETE FROM
   district
   WHERE 
   district_id=${districtId};`;

    const stateObj = await db.run(stateQuery);
    response.send("District Removed");
  }
);

// UPDATE district API

app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;

    const updateQuery = `
  UPDATE 
  district
  SET
   district_name='${districtName}',
   state_id=${stateId},
   cases=${cases},
   cured=${cured},
   active=${active},
   deaths=${deaths}
  WHERE
    district_id=${districtId};`;

    const districtObj = await db.run(updateQuery);
    response.send("District Details Updated");
  }
);

// GET state stats API

app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;

    const stateQuery = `
    SELECT SUM(cases) AS totalCases,SUM(cured) AS totalCured,SUM(active) AS totalActive,SUM(deaths) AS totalDeaths
    FROM 
    district INNER JOIN state 
    ON district.state_id=state.state_id
    WHERE 
    state.state_id=${stateId};`;

    const stateObj = await db.get(stateQuery);
    response.send(stateObj);
  }
);

module.exports = app;
