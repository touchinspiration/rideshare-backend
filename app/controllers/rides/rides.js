// external libraries
const geolib = require("geolib");

// project files
const { responseHandler } = require("../../utils/commonResponse");
const { createRecord } = require("../../utils/dbHeplerFunc");
const { checkUserExists } = require("../../utils/dbValidations");
const { pool } = require("../../config/db.config");
const { COORDINATE_THRESHOLD } = require("../../constants/constants");

exports.publishRides = async (req, res) => {
  const {
    user_id,
    pickup_location: { latitude: pickupLat, longitude: pickupLong },
    pickup_address,
    drop_off_location: { latitude: dropOffLat, longitude: dropOffLong },
    drop_off_address,
    tolls,
    route_time,
    city_of_route,
    route_miles,
    ride_date,
    time_to_pick_up_passengers,
    cautions,
    max_passengers,
    request_option,
    price_per_seat,
    return_ride_status,
  } = req.body;
  const pickupPoint = `(${pickupLat}, ${pickupLong})`;
  const dropOffPoint = `(${dropOffLat}, ${dropOffLong})`;
  const rideData = {
    user_id,
    pickup_location: pickupPoint,
    pickup_address: pickup_address,
    drop_off_location: dropOffPoint,
    drop_off_address,
    tolls,
    route_time,
    city_of_route,
    route_miles,
    ride_date,
    time_to_pickup: time_to_pick_up_passengers,
    cautions: cautions,
    max_passengers,
    request_option,
    price_per_seat,
    return_ride_status,
  };

  try {
    const user = await checkUserExists("users", "id", user_id);
    if (user.rowCount === 0) {
      return responseHandler(res, 404, false, "User not found");
    }
    const result = await createRecord("rides", rideData, []);

    if (result.error) {
      return responseHandler(res, result.status, false, result.message);
    }
    return responseHandler(
      res,
      201,
      true,
      "Ride details added successfully!",
      result.data
    );
  } catch (error) {
    console.error(error);
    return responseHandler(res, 500, false, "Internal Server Error");
  }
};




exports.search = async (req, res) => {
  try {
    const {
      pickup_location,
      drop_off_location,
      ride_date,
      max_passengers,
      max_price,
    } = req.query;

    // Fetch all rides
    const allRidesQuery = `SELECT * FROM rides;`;
    const allRidesResult = await pool.query(allRidesQuery);
    const allRides = allRidesResult.rows;

    const someRadius = 50;

    const filteredRides = allRides.filter((ride) => {
      let matchesCriteria = true;

      // Inside your filter function
      if (pickup_location) {
        const [pickupLat, pickupLong] = pickup_location
          .split(",")
          .map(parseFloat);
        const ridePickupLat = parseFloat(ride.pickup_location.x);
        const ridePickupLong = parseFloat(ride.pickup_location.y);

        matchesCriteria =
          matchesCriteria &&
          Math.abs(ridePickupLat - pickupLat) < COORDINATE_THRESHOLD &&
          Math.abs(ridePickupLong - pickupLong) < COORDINATE_THRESHOLD;
      }

      if (drop_off_location && matchesCriteria) {
        const [dropOffLat, dropOffLong] = drop_off_location
          .split(",")
          .map(parseFloat);
        const rideDropOffLat = parseFloat(ride.drop_off_location.x);
        const rideDropOffLong = parseFloat(ride.drop_off_location.y);

        // Debug log
        console.log(
          `Comparing Drop-off: (${dropOffLat}, ${dropOffLong}) with (${rideDropOffLat}, ${rideDropOffLong})`
        );

        matchesCriteria =
          matchesCriteria &&
          Math.abs(rideDropOffLat - dropOffLat) < COORDINATE_THRESHOLD &&
          Math.abs(rideDropOffLong - dropOffLong) < COORDINATE_THRESHOLD;
      }


      if (ride_date && matchesCriteria) {
        matchesCriteria =
          matchesCriteria && ride.ride_date.toISOString() === ride_date;
      }

      if (max_passengers && matchesCriteria) {
        matchesCriteria =
          matchesCriteria &&
          ride.max_passengers === parseInt(max_passengers, 10);
      }

      if (max_price && matchesCriteria) {
        matchesCriteria =
          matchesCriteria && ride.price_per_seat <= parseFloat(max_price);
      }

      return matchesCriteria;
    });

    return responseHandler(
      res,
      201,
      true,
      "Ride search successfully!",
      filteredRides
    );
  } catch (error) {
    console.error(error);
    return responseHandler(res, 500, false, "Internal Server Error");
  }
};

function isValidCoordinates(lat, long) {
  return lat >= -90 && lat <= 90 && long >= -180 && long <= 180;
}
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c * 0.621371;
  return distance;
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}
